from datetime import datetime, timedelta
import logging
import pyotp
import requests
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework import status

from apps.core.models import PhoneOtpUser, User
from firebase_admin import messaging

logger = logging.getLogger(__name__)

###################################################################################################################
# ── Envoi de messages : 3 canaux supportés (whatsapp / sms / email) ──


def _normalize_phone_for_ultramsg(number) -> str:
    """
    UltraMsg attend le numéro au format international SANS '+' ni espace.
    Ex: '+237 699 12 34 56' → '237699123456'
    """
    if not number:
        return ''
    s = str(number)
    # Garde uniquement les chiffres
    digits = ''.join(c for c in s if c.isdigit())
    return digits


def send_message(number, text):
    """
    Envoi WhatsApp via UltraMsg.

    Lit `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN` et `ULTRAMSG_BASE_URL`
    depuis les settings (eux-mêmes branchés sur l'environnement).
    Retourne le texte de réponse de l'API, ou un message d'erreur explicite.
    """
    instance_id = getattr(settings, 'ULTRAMSG_INSTANCE_ID', '')
    token = getattr(settings, 'ULTRAMSG_TOKEN', '')
    base_url = getattr(settings, 'ULTRAMSG_BASE_URL', 'https://api.ultramsg.com')

    if not instance_id or not token:
        logger.error(
            "UltraMsg non configuré : ULTRAMSG_INSTANCE_ID et "
            "ULTRAMSG_TOKEN doivent être définis dans l'environnement."
        )
        return 'ultramsg_not_configured'

    to_number = _normalize_phone_for_ultramsg(number)
    if not to_number:
        return 'invalid_phone'

    url = f"{base_url}/{instance_id}/messages/chat"
    payload = {
        "token": token,
        "to": to_number,
        "body": text,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    try:
        response = requests.post(url, data=payload, headers=headers, timeout=10)
        # Log explicite des erreurs HTTP UltraMsg (4xx/5xx)
        if response.status_code >= 400:
            logger.warning(
                "UltraMsg HTTP %s pour %s : %s",
                response.status_code, to_number, response.text[:200],
            )
        else:
            logger.info("UltraMsg envoyé à %s (HTTP %s)", to_number, response.status_code)
        return response.text
    except Exception as e:
        logger.exception("WhatsApp send failed")
        return str(e)


def send_sms(number, text):
    """
    Envoi SMS. Pour l'instant on relaie via UltraMsg (même endpoint que
    WhatsApp) — à remplacer par un vrai gateway SMS quand dispo
    (ex: Twilio / Africa's Talking / Orange API).
    """
    # TODO: brancher un gateway SMS distinct (Twilio, AfricasTalking…)
    return send_message(number, text)


def send_email_otp(email: str, code: str, *, first_name: str | None = None) -> bool:
    """
    Envoi du code OTP par email. Renvoie True si l'envoi a réussi.
    Utilise EmailMultiAlternatives pour fournir HTML + texte fallback.
    """
    if not email:
        return False

    subject = f"Votre code de vérification TontineX360 : {code}"
    salutation = f"Bonjour {first_name}," if first_name else "Bonjour,"
    text_body = (
        f"{salutation}\n\n"
        f"Voici votre code de vérification TontineX360 :\n\n"
        f"    {code}\n\n"
        f"Ce code expire dans quelques minutes. Si vous n'êtes pas à l'origine "
        f"de cette demande, ignorez ce message.\n\n"
        f"L'équipe TontineX360"
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;
                background: #F1F8E8; padding: 24px; border-radius: 16px;">
      <h2 style="color: #43793F; margin-top: 0;">TontineX360</h2>
      <p style="color: #1E3233; font-size: 14px;">{salutation}</p>
      <p style="color: #1E3233; font-size: 14px;">
        Voici votre code de vérification :
      </p>
      <div style="background: white; border: 2px dashed #87C241; border-radius: 12px;
                  padding: 16px; text-align: center; margin: 20px 0;">
        <p style="font-size: 28px; font-weight: bold; color: #43793F;
                  letter-spacing: 8px; margin: 0;">{code}</p>
      </div>
      <p style="color: #707070; font-size: 12px;">
        Ce code expire dans quelques minutes. Si vous n'êtes pas à l'origine
        de cette demande, ignorez ce message.
      </p>
      <p style="color: #707070; font-size: 12px; margin-bottom: 0;">
        — L'équipe TontineX360
      </p>
    </div>
    """
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            to=[email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        return True
    except Exception:
        logger.exception("OTP email send failed")
        return False


def send_otp(telephone):
    """Génère un code OTP (pyotp). `telephone` accepté pour compat héritée."""
    if not telephone:
        return False
    totp = pyotp.TOTP('base32secret3232')
    return str(totp.now())


def send_otp_forgot(telephone):
    if not telephone:
        return False
    totp = pyotp.TOTP('base32secret3232')
    return str(totp.now())


def sentOtp(telephone: str, channel: str = 'whatsapp', email: str | None = None):
    """
    Génère et stocke un OTP, puis l'envoie sur le canal demandé.

    `channel` ∈ {'whatsapp', 'sms', 'email'} :
    - whatsapp : envoi via UltraMsg (canal historique, défaut)
    - sms     : envoi SMS (actuellement relayé via UltraMsg, voir TODO)
    - email   : envoi email — requiert `email` rempli OU User.email lié au tel

    Retourne le code OTP (str) si envoi OK, False sinon, Response 400/429
    en cas d'erreur métier.
    """
    if not telephone:
        return Response({
            'status': False,
            'error': "Numéro de téléphone requis."
        }, status=status.HTTP_400_BAD_REQUEST)

    otp = send_otp(telephone)
    if not otp:
        return False
    otp = str(otp)

    # ── Anti-abus : rate limit 7 tentatives ──
    old_otp = PhoneOtpUser.objects.filter(telephone=telephone).first()
    if old_otp:
        if old_otp.count > 7:
            current_time = datetime.now()
            old_otp.time_restart = current_time + timedelta(minutes=1)
            old_otp.count = 1
            old_otp.save()
            return Response({
                'status': False,
                'error': 'Trop de tentatives. Réessayez dans quelques minutes.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        old_otp.count += 1
        old_otp.otp = otp
        old_otp.save()
    else:
        PhoneOtpUser.objects.create(telephone=telephone, otp=otp, count=1)

    # ── Dispatch selon le canal ──
    channel = (channel or 'whatsapp').lower()
    message = f"Voici votre code d'activation TontineX360 : {otp}"

    if channel == 'email':
        # Email cible : explicite OU email du user lié au telephone
        target_email = email
        first_name = None
        if not target_email:
            user = User.objects.filter(telephone=telephone).first()
            if user:
                target_email = user.email
                first_name = user.first_name
        if not target_email:
            return Response({
                'status': False,
                'error': "Aucune adresse email associée à ce compte. Choisissez WhatsApp ou SMS."
            }, status=status.HTTP_400_BAD_REQUEST)
        ok = send_email_otp(target_email, otp, first_name=first_name)
        if not ok:
            return Response({
                'status': False,
                'error': "Échec de l'envoi de l'email. Vérifiez l'adresse ou réessayez."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    elif channel == 'sms':
        send_sms(telephone, message)
    else:
        # 'whatsapp' par défaut
        send_message(telephone, message)

    logger.info("OTP %s sent to %s via %s", otp, telephone, channel)
    return otp


#########################################################################################################################
#############################################################################################################################
def send_push_notification(token, title, body, data=None):
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=data or {},
        token=token,
    )

    response = messaging.send(message)
    return response

def notify_user(user, title, body):
    tokens = user.fcm_tokens.values_list("token", flat=True)

    for token in tokens:
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                token=token
            )
            messaging.send(message)
        except:
            pass 