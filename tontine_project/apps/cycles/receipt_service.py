"""
Service de génération de bordereau de réception PDF.

Bordereau = preuve de réception d'un versement par un bénéficiaire :
    - identité asso/cycle/séance
    - détails du versement (montant en chiffres + lettres, méthode, etc.)
    - signature de référence du membre (si dispo)
    - signature DU JOUR capturée live
    - hash SHA-256 du contenu (intégrité)
    - QR code de vérification publique
    - horodatage + métadonnées device
"""
import base64
import hashlib
import io
import json
from datetime import datetime
from decimal import Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image,
)
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing


ORANGE = colors.HexColor('#D4763B')
DARK = colors.HexColor('#1B2838')
GREEN = colors.HexColor('#2C7A5A')
GRAY = colors.HexColor('#6B7280')
LIGHT = colors.HexColor('#F3F4F6')


def _amount_in_words_fr(amount: Decimal) -> str:
    """Conversion simple en lettres (français). À étendre si besoin."""
    try:
        from num2words import num2words
        return num2words(int(amount), lang='fr')
    except ImportError:
        return f"{int(amount):,}".replace(',', ' ')


def _styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='RBody', parent=s['Normal'],
        fontSize=10, leading=13, textColor=DARK))
    s.add(ParagraphStyle(name='RSmall', parent=s['Normal'],
        fontSize=8, leading=11, textColor=GRAY))
    s.add(ParagraphStyle(name='RTitle', parent=s['Heading1'],
        fontSize=18, leading=22, textColor=ORANGE, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='RH', parent=s['Heading2'],
        fontSize=12, leading=15, textColor=DARK, fontName='Helvetica-Bold',
        spaceBefore=8, spaceAfter=4))
    return s


def _qr_drawing(text: str, size_mm: float = 25) -> Drawing:
    qr = QrCodeWidget(text)
    bounds = qr.getBounds()
    w = bounds[2] - bounds[0]
    h = bounds[3] - bounds[1]
    target = size_mm * mm
    d = Drawing(target, target, transform=[target / w, 0, 0, target / h, 0, 0])
    d.add(qr)
    return d


def _image_from_field_or_b64(field_or_b64, max_w: float, max_h: float):
    """Renvoie un platypus.Image depuis un FileField ou une data-URL base64."""
    if not field_or_b64:
        return None
    src = None
    if hasattr(field_or_b64, 'path'):  # ImageField/FileField
        try:
            src = field_or_b64.path
        except Exception:
            src = None
    elif isinstance(field_or_b64, str) and field_or_b64.startswith('data:'):
        try:
            _, b64 = field_or_b64.split(',', 1)
            src = io.BytesIO(base64.b64decode(b64))
        except Exception:
            src = None
    if src is None:
        return None
    try:
        img = Image(src, width=max_w, height=max_h, kind='proportional')
        return img
    except Exception:
        return None


def _compute_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str).encode('utf-8')
    return hashlib.sha256(canonical).hexdigest()


def generate_payout_receipt(payout, signature_b64: str | None = None,
                            device_info: dict | None = None,
                            base_url: str | None = None) -> dict:
    """
    Génère le bordereau PDF pour un BeneficiaryPayout, et retourne :
        {
            'pdf_content': bytes,
            'filename': str,
            'hash': str,
            'receipt_number': str,
            'signed_at': datetime,
            'device_info': dict,
        }

    NB : ne sauvegarde PAS sur le modèle — l'appelant le fait.
    """
    association = payout.association
    membership = payout.membership
    user = membership.user
    pot = payout.pot
    session = pot.session
    cycle = session.cycle
    tontine_type = pot.tontine_type

    now = timezone.now()

    # Numéro séquentiel : récupère le max existant + 1
    from apps.cycles.models import BeneficiaryPayout
    last_num = BeneficiaryPayout.all_objects.filter(
        association=association, receipt_number__startswith='BR-',
    ).order_by('-receipt_number').values_list('receipt_number', flat=True).first()
    try:
        next_seq = int(last_num.split('-')[1]) + 1 if last_num else 1
    except Exception:
        next_seq = 1
    receipt_number = f"BR-{next_seq:06d}"

    # Payload qui sera hashé (preuve d'intégrité)
    hash_payload = {
        'receipt_number': receipt_number,
        'association_id': str(association.id),
        'association_slug': association.slug,
        'payout_id': str(payout.id),
        'membership_id': str(membership.id),
        'beneficiary': f"{user.first_name or ''} {user.last_name or ''}".strip(),
        'amount': str(payout.amount),
        'currency': (association.settings or {}).get('currency', 'XAF'),
        'method': payout.acquisition_method,
        'payout_method': payout.payout_method,
        'session_number': session.session_number,
        'session_date': str(session.date),
        'tontine_type': tontine_type.name if tontine_type else None,
        'signed_at': now.isoformat(),
        'device_info': device_info or {},
    }
    receipt_hash = _compute_hash(hash_payload)

    verify_url = f"{base_url or 'https://app.tontinex360.com'}/verify/{receipt_hash}"

    # ─── Construction du PDF ───────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title=f"Bordereau de réception {receipt_number}",
    )
    s = _styles()
    story = []

    # En-tête
    header = Table([[
        Paragraph(f"<b>{association.name}</b><br/>"
                  f"<font color='#6B7280' size='8'>{association.city or ''} {association.country or ''}</font>",
                  s['RBody']),
        Paragraph(f"<b>BORDEREAU DE RÉCEPTION</b><br/>"
                  f"<font color='#D4763B' size='10'>N° {receipt_number}</font>",
                  s['RBody']),
    ]], colWidths=[10 * cm, 7 * cm])
    header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, ORANGE),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
    ]))
    story.append(header)
    story.append(Spacer(1, 0.4 * cm))

    # Identité
    story.append(Paragraph("Identification", s['RH']))
    ident = [
        ['Bénéficiaire', f"{user.first_name or ''} {user.last_name or ''}".strip()],
        ['Téléphone', user.telephone or ''],
        ["N° de membre", membership.member_number or ''],
        ['Cycle', cycle.name],
        ['Séance', f"n°{session.session_number} du {session.date}"],
        ['Tontine', tontine_type.name if tontine_type else '—'],
    ]
    t = Table(ident, colWidths=[5 * cm, 12 * cm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.4 * cm))

    # Versement
    story.append(Paragraph("Versement", s['RH']))
    amount_xaf = f"{int(payout.amount):,}".replace(',', ' ')
    currency = (association.settings or {}).get('currency', 'XAF')
    amount_words = _amount_in_words_fr(payout.amount)

    payout_table = Table([
        ['Montant', f"{amount_xaf} {currency}"],
        ['En toutes lettres', f"{amount_words} {currency.lower()}"],
        ['Parts perçues', f"{payout.shares_claimed} / {payout.shares_total}"],
        ["Méthode d'attribution", payout.get_acquisition_method_display()],
        ['Mode de paiement', payout.get_payout_method_display() if payout.payout_method else '—'],
    ], colWidths=[5 * cm, 12 * cm])
    payout_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), GRAY),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (1, 0), (1, 0), LIGHT),
        ('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 0), (1, 0), 11),
        ('TEXTCOLOR', (1, 0), (1, 0), GREEN),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(payout_table)
    story.append(Spacer(1, 0.6 * cm))

    # Signatures (référence + actuelle)
    story.append(Paragraph("Signatures", s['RH']))

    ref_img = _image_from_field_or_b64(
        membership.signature_reference, max_w=6.5 * cm, max_h=3 * cm,
    )
    live_img = _image_from_field_or_b64(
        signature_b64, max_w=6.5 * cm, max_h=3 * cm,
    )

    sig_cell_ref = [
        Paragraph("<b>Signature de référence</b>", s['RSmall']),
        ref_img if ref_img else Paragraph("<i>Non enregistrée</i>", s['RSmall']),
    ]
    sig_cell_live = [
        Paragraph(f"<b>Signature du jour</b> ({now.strftime('%d/%m/%Y %H:%M')})", s['RSmall']),
        live_img if live_img else Paragraph("<i>Non capturée</i>", s['RSmall']),
    ]
    sig_table = Table(
        [[sig_cell_ref, sig_cell_live]],
        colWidths=[8 * cm, 8 * cm], rowHeights=[4.5 * cm],
    )
    sig_table.setStyle(TableStyle([
        ('BOX', (0, 0), (0, 0), 0.5, GRAY),
        ('BOX', (1, 0), (1, 0), 0.5, ORANGE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(sig_table)

    story.append(Spacer(1, 0.5 * cm))

    # Pied : QR + hash
    qr = _qr_drawing(verify_url, size_mm=25)
    footer_cells = [
        [qr,
         Paragraph(
             f"<b>Vérification d'intégrité</b><br/>"
             f"<font size='7'>Hash SHA-256 :</font><br/>"
             f"<font name='Courier' size='6.5'>{receipt_hash}</font><br/><br/>"
             f"<font size='7'>Scanner le QR pour vérifier en ligne :<br/>"
             f"{verify_url}</font>",
             s['RSmall']),
         Paragraph(
             "<b>Métadonnées</b><br/>"
             f"<font size='7'>Date/heure : {now.strftime('%d/%m/%Y %H:%M:%S %Z')}<br/>"
             f"Device : {(device_info or {}).get('platform', '—')}<br/>"
             f"IP : {(device_info or {}).get('ip', '—')}<br/>"
             f"User-Agent : {(device_info or {}).get('user_agent', '—')[:50]}</font>",
             s['RSmall']),
         ],
    ]
    footer = Table(footer_cells, colWidths=[3 * cm, 6 * cm, 8 * cm])
    footer.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEABOVE', (0, 0), (-1, 0), 0.5, GRAY),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
    ]))
    story.append(footer)

    doc.build(story)
    pdf_bytes = buf.getvalue()
    buf.close()

    return {
        'pdf_content': pdf_bytes,
        'filename': f"bordereau_{receipt_number}.pdf",
        'hash': receipt_hash,
        'receipt_number': receipt_number,
        'signed_at': now,
        'device_info': device_info or {},
        'verify_url': verify_url,
    }


def attach_receipt_to_payout(payout, signature_b64: str, device_info: dict,
                             base_url: str | None = None):
    """Génère le bordereau et l'attache au BeneficiaryPayout."""
    result = generate_payout_receipt(
        payout,
        signature_b64=signature_b64,
        device_info=device_info,
        base_url=base_url,
    )

    # Stocke la signature live
    if signature_b64 and signature_b64.startswith('data:'):
        try:
            header, b64 = signature_b64.split(',', 1)
            sig_bytes = base64.b64decode(b64)
            payout.receipt_signature.save(
                f"sig_{result['receipt_number']}.png",
                ContentFile(sig_bytes), save=False,
            )
        except Exception:
            pass

    # Stocke le PDF
    payout.receipt_pdf.save(
        result['filename'],
        ContentFile(result['pdf_content']), save=False,
    )

    payout.receipt_hash = result['hash']
    payout.receipt_number = result['receipt_number']
    payout.receipt_signed_at = result['signed_at']
    payout.receipt_device_info = result['device_info']
    payout.save(update_fields=[
        'receipt_signature', 'receipt_pdf', 'receipt_hash',
        'receipt_number', 'receipt_signed_at', 'receipt_device_info',
    ])

    return result
