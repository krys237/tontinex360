"""
Service générique de génération de bordereaux PDF.
Réutilise la mécanique de apps.cycles.receipt_service mais adapté aux
Contribution, LoanRepayment, Sanction.
"""
import base64
import hashlib
import io
import json
from decimal import Decimal

from django.core.files.base import ContentFile
from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
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


def _amount_words(amount: Decimal) -> str:
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
    if not field_or_b64:
        return None
    src = None
    if hasattr(field_or_b64, 'path'):
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
        return Image(src, width=max_w, height=max_h, kind='proportional')
    except Exception:
        return None


def _compute_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str).encode('utf-8')
    return hashlib.sha256(canonical).hexdigest()


def _next_sequence(association, prefix: str, model_class) -> str:
    """Génère le prochain n° séquentiel BRC/BRR/BRS."""
    qs = model_class.all_objects.filter(
        association=association,
        receipt_number__startswith=prefix,
    ).order_by('-receipt_number').values_list('receipt_number', flat=True)
    last_num = qs.first()
    try:
        next_seq = int(last_num.split('-')[1]) + 1 if last_num else 1
    except Exception:
        next_seq = 1
    return f"{prefix}-{next_seq:06d}"


# =============================================================================
# Bordereau générique
# =============================================================================

def _build_pdf(
    *,
    association,
    membership,
    title: str,
    receipt_number: str,
    operation_rows: list,  # liste de (label, value)
    amount: Decimal,
    currency: str,
    signature_b64: str | None,
    receipt_hash: str,
    verify_url: str,
    device_info: dict,
    now,
) -> bytes:
    s = _styles()
    user = membership.user
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title=f"{title} {receipt_number}",
    )
    story = []

    # En-tête
    header = Table([[
        Paragraph(f"<b>{association.name}</b><br/>"
                  f"<font color='#6B7280' size='8'>{association.city or ''} {association.country or ''}</font>",
                  s['RBody']),
        Paragraph(f"<b>{title.upper()}</b><br/>"
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

    # Membre
    story.append(Paragraph("Membre concerné", s['RH']))
    ident = [
        ['Nom', f"{user.first_name or ''} {user.last_name or ''}".strip()],
        ['Téléphone', user.telephone or ''],
        ["N° de membre", membership.member_number or ''],
        ['Association', association.name],
    ]
    t = Table(ident, colWidths=[5 * cm, 12 * cm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), GRAY),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.4 * cm))

    # Opération
    story.append(Paragraph("Détails de l'opération", s['RH']))
    amount_str = f"{int(amount):,}".replace(',', ' ')
    amount_in_words = _amount_words(amount)
    rows = list(operation_rows) + [
        ['Montant', f"{amount_str} {currency}"],
        ['En toutes lettres', f"{amount_in_words} {currency.lower()}"],
    ]
    t2 = Table(rows, colWidths=[5 * cm, 12 * cm])
    t2.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), GRAY),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (1, -2), (1, -2), LIGHT),
        ('FONTNAME', (1, -2), (1, -2), 'Helvetica-Bold'),
        ('FONTSIZE', (1, -2), (1, -2), 11),
        ('TEXTCOLOR', (1, -2), (1, -2), GREEN),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t2)
    story.append(Spacer(1, 0.6 * cm))

    # Signatures
    story.append(Paragraph("Signature", s['RH']))
    ref_img = _image_from_field_or_b64(
        membership.signature_reference, max_w=6.5 * cm, max_h=3 * cm,
    )
    live_img = _image_from_field_or_b64(
        signature_b64, max_w=6.5 * cm, max_h=3 * cm,
    )
    sig_table = Table([[
        [Paragraph("<b>Signature de référence</b>", s['RSmall']),
         ref_img if ref_img else Paragraph("<i>Non enregistrée</i>", s['RSmall'])],
        [Paragraph(f"<b>Signature du jour</b> ({now.strftime('%d/%m/%Y %H:%M')})", s['RSmall']),
         live_img if live_img else Paragraph("<i>Non capturée</i>", s['RSmall'])],
    ]], colWidths=[8 * cm, 8 * cm], rowHeights=[4.5 * cm])
    sig_table.setStyle(TableStyle([
        ('BOX', (0, 0), (0, 0), 0.5, GRAY),
        ('BOX', (1, 0), (1, 0), 0.5, ORANGE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 0.5 * cm))

    # Pied : QR + hash
    qr = _qr_drawing(verify_url, size_mm=25)
    footer_cells = [[
        qr,
        Paragraph(
            "<b>Vérification d'intégrité</b><br/>"
            f"<font size='7'>Hash SHA-256 :</font><br/>"
            f"<font name='Courier' size='6.5'>{receipt_hash}</font><br/><br/>"
            f"<font size='7'>Scanner le QR pour vérifier en ligne :<br/>{verify_url}</font>",
            s['RSmall']),
        Paragraph(
            "<b>Métadonnées</b><br/>"
            f"<font size='7'>Date/heure : {now.strftime('%d/%m/%Y %H:%M:%S')}<br/>"
            f"Device : {(device_info or {}).get('platform', '—')}<br/>"
            f"IP : {(device_info or {}).get('ip', '—')}<br/>"
            f"User-Agent : {(device_info or {}).get('user_agent', '—')[:50]}</font>",
            s['RSmall']),
    ]]
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
    return pdf_bytes


# =============================================================================
# Dispatchers spécifiques par type
# =============================================================================

def sign_contribution_receipt(contribution, signature_b64: str, device_info: dict,
                              base_url: str | None = None):
    from apps.finance.models import Contribution
    now = timezone.now()
    association = contribution.association
    membership = contribution.membership
    tontine = contribution.tontine_type
    currency = (association.settings or {}).get('currency', 'XAF')
    receipt_number = _next_sequence(association, 'BRC', Contribution)

    amount = contribution.paid_amount or contribution.expected_amount

    hash_payload = {
        'kind': 'contribution',
        'receipt_number': receipt_number,
        'association_id': str(association.id),
        'contribution_id': str(contribution.id),
        'membership_id': str(membership.id),
        'amount': str(amount),
        'currency': currency,
        'signed_at': now.isoformat(),
        'device_info': device_info or {},
    }
    receipt_hash = _compute_hash(hash_payload)
    verify_url = f"{base_url or 'https://app.tontinex360.com'}/verify/{receipt_hash}"

    operation_rows = [
        ['Type', 'Cotisation'],
        ['Tontine', tontine.name if tontine else '—'],
        ['Séance', f"n°{contribution.session.session_number} du {contribution.session.date}"],
        ["Nombre de parts", str(contribution.num_shares)],
        ['Statut', contribution.get_status_display()],
        ['Mode', contribution.payment_method or '—'],
    ]

    pdf_bytes = _build_pdf(
        association=association, membership=membership,
        title="Bordereau de cotisation",
        receipt_number=receipt_number,
        operation_rows=operation_rows,
        amount=amount, currency=currency,
        signature_b64=signature_b64,
        receipt_hash=receipt_hash, verify_url=verify_url,
        device_info=device_info, now=now,
    )

    # Sauvegarde signature
    if signature_b64 and signature_b64.startswith('data:'):
        try:
            _, b64 = signature_b64.split(',', 1)
            contribution.receipt_signature.save(
                f"sig_{receipt_number}.png",
                ContentFile(base64.b64decode(b64)), save=False,
            )
        except Exception:
            pass

    contribution.receipt_pdf.save(
        f"bordereau_{receipt_number}.pdf",
        ContentFile(pdf_bytes), save=False,
    )
    contribution.receipt_hash = receipt_hash
    contribution.receipt_number = receipt_number
    contribution.receipt_signed_at = now
    contribution.receipt_device_info = device_info or {}
    contribution.save()

    return {
        'receipt_number': receipt_number,
        'hash': receipt_hash,
        'verify_url': verify_url,
    }


def sign_loan_repayment_receipt(repayment, signature_b64: str, device_info: dict,
                                base_url: str | None = None):
    from apps.finance.models import LoanRepayment
    now = timezone.now()
    association = repayment.association
    loan = repayment.loan
    membership = loan.membership
    currency = (association.settings or {}).get('currency', 'XAF')
    receipt_number = _next_sequence(association, 'BRR', LoanRepayment)

    hash_payload = {
        'kind': 'loan_repayment',
        'receipt_number': receipt_number,
        'association_id': str(association.id),
        'repayment_id': str(repayment.id),
        'loan_id': str(loan.id),
        'membership_id': str(membership.id),
        'amount': str(repayment.amount),
        'currency': currency,
        'signed_at': now.isoformat(),
        'device_info': device_info or {},
    }
    receipt_hash = _compute_hash(hash_payload)
    verify_url = f"{base_url or 'https://app.tontinex360.com'}/verify/{receipt_hash}"

    operation_rows = [
        ['Type', 'Remboursement de prêt'],
        ["Prêt initial", f"{int(loan.amount):,}".replace(',', ' ') + f" {currency}"],
        ['Déjà remboursé', f"{int(loan.total_repaid):,}".replace(',', ' ') + f" {currency}"],
        ['Reste dû', f"{int(loan.total_due - loan.total_repaid):,}".replace(',', ' ') + f" {currency}"],
        ['Mode', repayment.payment_method or '—'],
    ]

    pdf_bytes = _build_pdf(
        association=association, membership=membership,
        title="Bordereau de remboursement",
        receipt_number=receipt_number,
        operation_rows=operation_rows,
        amount=repayment.amount, currency=currency,
        signature_b64=signature_b64,
        receipt_hash=receipt_hash, verify_url=verify_url,
        device_info=device_info, now=now,
    )

    if signature_b64 and signature_b64.startswith('data:'):
        try:
            _, b64 = signature_b64.split(',', 1)
            repayment.receipt_signature.save(
                f"sig_{receipt_number}.png",
                ContentFile(base64.b64decode(b64)), save=False,
            )
        except Exception:
            pass

    repayment.receipt_pdf.save(
        f"bordereau_{receipt_number}.pdf",
        ContentFile(pdf_bytes), save=False,
    )
    repayment.receipt_hash = receipt_hash
    repayment.receipt_number = receipt_number
    repayment.receipt_signed_at = now
    repayment.receipt_device_info = device_info or {}
    repayment.save()

    return {
        'receipt_number': receipt_number,
        'hash': receipt_hash,
        'verify_url': verify_url,
    }


def sign_sanction_receipt(sanction, signature_b64: str, device_info: dict,
                          base_url: str | None = None):
    from apps.sanctions.models import Sanction
    now = timezone.now()
    association = sanction.association
    membership = sanction.membership
    currency = (association.settings or {}).get('currency', 'XAF')
    receipt_number = _next_sequence(association, 'BRS', Sanction)

    hash_payload = {
        'kind': 'sanction',
        'receipt_number': receipt_number,
        'association_id': str(association.id),
        'sanction_id': str(sanction.id),
        'membership_id': str(membership.id),
        'amount': str(sanction.amount),
        'currency': currency,
        'signed_at': now.isoformat(),
        'device_info': device_info or {},
    }
    receipt_hash = _compute_hash(hash_payload)
    verify_url = f"{base_url or 'https://app.tontinex360.com'}/verify/{receipt_hash}"

    operation_rows = [
        ['Type', f"Sanction — {sanction.sanction_type.name}"],
        ['Motif', sanction.reason or '—'],
        ['Statut', sanction.get_status_display()],
    ]
    if sanction.session:
        operation_rows.append(
            ['Séance', f"n°{sanction.session.session_number} du {sanction.session.date}"]
        )

    pdf_bytes = _build_pdf(
        association=association, membership=membership,
        title="Bordereau de sanction",
        receipt_number=receipt_number,
        operation_rows=operation_rows,
        amount=sanction.amount, currency=currency,
        signature_b64=signature_b64,
        receipt_hash=receipt_hash, verify_url=verify_url,
        device_info=device_info, now=now,
    )

    if signature_b64 and signature_b64.startswith('data:'):
        try:
            _, b64 = signature_b64.split(',', 1)
            sanction.receipt_signature.save(
                f"sig_{receipt_number}.png",
                ContentFile(base64.b64decode(b64)), save=False,
            )
        except Exception:
            pass

    sanction.receipt_pdf.save(
        f"bordereau_{receipt_number}.pdf",
        ContentFile(pdf_bytes), save=False,
    )
    sanction.receipt_hash = receipt_hash
    sanction.receipt_number = receipt_number
    sanction.receipt_signed_at = now
    sanction.receipt_device_info = device_info or {}
    sanction.save()

    return {
        'receipt_number': receipt_number,
        'hash': receipt_hash,
        'verify_url': verify_url,
    }
