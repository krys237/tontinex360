"""
Génère le rapport PDF d'analyse UEMOA/CEMAC.

Usage :
    docker compose exec backend python scripts/generate_analysis_pdf.py
"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether,
)


# =============================================================================
# Palette
# =============================================================================
ORANGE = colors.HexColor('#D4763B')
GREEN = colors.HexColor('#2C7A5A')
DARK = colors.HexColor('#1B2838')
GRAY = colors.HexColor('#6B7280')
LIGHT_GRAY = colors.HexColor('#F3F4F6')
RED = colors.HexColor('#DC2626')
AMBER = colors.HexColor('#D97706')
YELLOW = colors.HexColor('#CA8A04')
EMERALD = colors.HexColor('#059669')


# =============================================================================
# Styles
# =============================================================================
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name='TitleMain',
    parent=styles['Heading1'],
    fontSize=22, leading=28,
    textColor=DARK, spaceAfter=8,
    fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    name='Subtitle',
    parent=styles['Normal'],
    fontSize=11, leading=15,
    textColor=GRAY, spaceAfter=20, italic=True,
    fontName='Helvetica-Oblique',
))
styles.add(ParagraphStyle(
    name='H1',
    parent=styles['Heading1'],
    fontSize=16, leading=20,
    textColor=ORANGE, spaceBefore=18, spaceAfter=8,
    fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    name='H2',
    parent=styles['Heading2'],
    fontSize=13, leading=17,
    textColor=DARK, spaceBefore=12, spaceAfter=6,
    fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    name='H3',
    parent=styles['Heading3'],
    fontSize=11, leading=15,
    textColor=DARK, spaceBefore=8, spaceAfter=4,
    fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    name='Body',
    parent=styles['Normal'],
    fontSize=9.5, leading=13,
    textColor=DARK, spaceAfter=6,
    alignment=TA_JUSTIFY,
))
styles.add(ParagraphStyle(
    name='TxBullet',
    parent=styles['Normal'],
    fontSize=9.5, leading=13,
    textColor=DARK, leftIndent=14, bulletIndent=4, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name='Cell',
    parent=styles['Normal'],
    fontSize=8.5, leading=11,
    textColor=DARK,
))
styles.add(ParagraphStyle(
    name='CellSmall',
    parent=styles['Normal'],
    fontSize=8, leading=10,
    textColor=DARK,
))
styles.add(ParagraphStyle(
    name='Note',
    parent=styles['Normal'],
    fontSize=9, leading=12,
    textColor=GRAY, italic=True, spaceAfter=8,
    fontName='Helvetica-Oblique',
))


def p(text, style='Body'):
    return Paragraph(text, styles[style])


def bullet(text):
    return Paragraph(f"• {text}", styles['TxBullet'])


def cell(text, style='Cell'):
    return Paragraph(str(text), styles[style])


# =============================================================================
# Contenu
# =============================================================================

def build_story():
    story = []

    # ==== COUVERTURE ====
    story.append(Spacer(1, 4 * cm))
    story.append(p("ANALYSE COMPARATIVE", 'TitleMain'))
    story.append(p(
        "Adéquation du projet TontineX360 aux pratiques de gestion "
        "des associations dans la zone UEMOA &amp; CEMAC (hors Cameroun)",
        'Subtitle',
    ))
    story.append(Spacer(1, 2 * cm))

    cover_table = Table([
        [cell("Périmètre couvert", 'Cell'), cell(
            "<b>UEMOA</b> : Bénin, Burkina Faso, Côte d'Ivoire, Guinée-Bissau, "
            "Mali, Niger, Sénégal, Togo<br/><br/>"
            "<b>CEMAC</b> : Centrafrique, Congo, Gabon, Guinée Équatoriale, Tchad",
            'Cell')],
        [cell("Date", 'Cell'), cell("Avril 2026", 'Cell')],
        [cell("Auteur", 'Cell'), cell("Équipe TontineX360", 'Cell')],
        [cell("Version", 'Cell'), cell("1.0", 'Cell')],
    ], colWidths=[4 * cm, 12 * cm])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
        ('TEXTCOLOR', (0, 0), (0, -1), DARK),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(cover_table)

    story.append(Spacer(1, 3 * cm))
    story.append(p(
        "<b>Synthèse exécutive.</b> Le projet TontineX360 dispose d'une "
        "architecture multi-tenant flexible qui couvre déjà <b>~70 % des besoins "
        "métier</b> dans la zone UEMOA/CEMAC. Toutefois, 4 lacunes bloquantes "
        "(Mobile Money, fréquence quotidienne, rôle collecteur, multi-langue) "
        "doivent être traitées pour ouvrir le marché informel — qui représente "
        "l'écrasante majorité des associations cibles.",
        'Body',
    ))

    story.append(PageBreak())

    # ==== 1. CARTOGRAPHIE PAR PAYS ====
    story.append(p("1. Cartographie des pratiques par pays", 'H1'))
    story.append(p(
        "Synthèse des modèles dominants de tontines &amp; associations "
        "communautaires dans chacun des pays cibles, hors Cameroun.",
        'Body',
    ))

    # Tableau UEMOA
    story.append(p("UEMOA — Afrique de l'Ouest (devise XOF)", 'H2'))
    uemoa = [
        [cell("<b>Pays</b>", 'Cell'),
         cell("<b>Pratiques dominantes</b>", 'Cell'),
         cell("<b>Spécificités culturelles</b>", 'Cell')],
        [cell("Sénégal", 'CellSmall'),
         cell("« Natt » (rotation), « Mbotaye » (mutuelles femmes), tontines confrériques mouride/tijaniyya, tontines Tabaski / cercueil", 'CellSmall'),
         cell("Animatrices, marabouts témoins, Wave dominant, dahiras", 'CellSmall')],
        [cell("Côte d'Ivoire", 'CellSmall'),
         cell("« Yoo », « Apati », tontines de marché, tontines de quartier", 'CellSmall'),
         cell("Mobile Money intensif (Orange/MTN/Wave/Moov), forte diaspora", 'CellSmall')],
        [cell("Mali", 'CellSmall'),
         cell("« Pari » des commerçants, « Tonton », « Bara mussow » (femmes)", 'CellSmall'),
         cell("Tradition de la parole donnée, sanctions par les anciens", 'CellSmall')],
        [cell("Burkina Faso", 'CellSmall'),
         cell("« Kèrè », tontines villageoises", 'CellSmall'),
         cell("Quotidienne en urbain, mensuelle en rural", 'CellSmall')],
        [cell("Bénin", 'CellSmall'),
         cell("<b>Tontines quotidiennes à collecteur</b> (modèle célèbre), « Adjogan » funéraire", 'CellSmall'),
         cell("Collecteur garde 1 jour = commission ; vodun", 'CellSmall')],
        [cell("Togo", 'CellSmall'),
         cell("« Ayiha », mutuelles de marché", 'CellSmall'),
         cell("Daily collection très répandue", 'CellSmall')],
        [cell("Niger", 'CellSmall'),
         cell("« Toonta » communautaire, tontines agricoles", 'CellSmall'),
         cell("Versement en nature (mil, sorgho)", 'CellSmall')],
        [cell("Guinée-Bissau", 'CellSmall'),
         cell("« Abota »", 'CellSmall'),
         cell("Lusophone, échanges avec diaspora portugaise", 'CellSmall')],
    ]
    t = Table(uemoa, colWidths=[2.5 * cm, 7 * cm, 6.5 * cm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t)

    story.append(Spacer(1, 0.5 * cm))

    # Tableau CEMAC
    story.append(p("CEMAC — Afrique centrale (devise XAF, hors Cameroun)", 'H2'))
    cemac = [
        [cell("<b>Pays</b>", 'Cell'),
         cell("<b>Pratiques dominantes</b>", 'Cell'),
         cell("<b>Spécificités</b>", 'Cell')],
        [cell("Gabon", 'CellSmall'),
         cell("Tontines salariales (entreprises, fonctionnaires), tournois", 'CellSmall'),
         cell("Tissu économique pétrolier, plus formel", 'CellSmall')],
        [cell("Congo", 'CellSmall'),
         cell("<b>« Likélemba »</b> (très courant), tontines féminines", 'CellSmall'),
         cell("Daily/weekly, Mobile Money MTN/Airtel", 'CellSmall')],
        [cell("Tchad", 'CellSmall'),
         cell("« Mbaibe », tontines mosquée", 'CellSmall'),
         cell("Calendrier hégirien, versement nature céréales", 'CellSmall')],
        [cell("Centrafrique", 'CellSmall'),
         cell("Tontines de quartier (faute d'infra bancaire)", 'CellSmall'),
         cell("Forte informalité due au contexte sécuritaire", 'CellSmall')],
        [cell("Guinée Éq.", 'CellSmall'),
         cell("Réseaux familiaux, peu de tontines structurées", 'CellSmall'),
         cell("Influence espagnole, marché restreint", 'CellSmall')],
    ]
    t = Table(cemac, colWidths=[2.5 * cm, 7 * cm, 6.5 * cm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t)

    story.append(PageBreak())

    # ==== 2. CE QUE LE PROJET COUVRE DÉJÀ ====
    story.append(p("2. Ce que TontineX360 couvre déjà bien", 'H1'))
    story.append(p(
        "Tableau récapitulatif des besoins métier identifiés et de leur "
        "couverture par la plateforme actuelle.",
        'Body',
    ))

    covered = [
        [cell("<b>Besoin métier</b>"), cell("<b>Couverture</b>")],
        [cell("Plusieurs cotisations en parallèle (principale + cercueil + Tabaski)"),
         cell("<font color='#059669'><b>Oui</b></font> — <i>TontineType</i> multi-instances par cycle")],
        [cell("Multi-parts (« bouche », « nom », « main »)"),
         cell("<font color='#059669'><b>Oui</b></font> — <i>num_shares</i> + <i>share_unit_name</i> configurable")],
        [cell("6 méthodes d'attribution (rotation, tirage, enchère, vote, besoin, manuel)"),
         cell("<font color='#059669'><b>Oui</b></font> — <i>AcquisitionMethod</i> complet")],
        [cell("Rôles personnalisés par association (Censeur, Animatrice…)"),
         cell("<font color='#059669'><b>Oui</b></font> — <i>Role</i> éditable par le président")],
        [cell("Sanctions configurables (fixe ou plage, auto ou manuel)"),
         cell("<font color='#059669'><b>Oui</b></font> — Module complet")],
        [cell("Procurations entre membres"),
         cell("<font color='#059669'><b>Oui</b></font> — Cohérent avec le « ramasseur de proximité »")],
        [cell("Wallets virtuels traçables"),
         cell("<font color='#059669'><b>Oui</b></font> — Innovation différenciante")],
        [cell("Devise par association (XOF, XAF, EUR, USD)"),
         cell("<font color='#059669'><b>Oui</b></font> — Setting <i>currency</i> JSON")],
        [cell("Multi-cycle (annuel, semestriel, etc.)"),
         cell("<font color='#059669'><b>Oui</b></font> — Compatible « tontine annuelle » dominante")],
        [cell("Compensation collective des défauts"),
         cell("<font color='#059669'><b>Oui</b></font> — Configurable (auto ou manuel)")],
        [cell("Documents officiels versionnés (statuts, PV)"),
         cell("<font color='#059669'><b>Oui</b></font> — Module Documents avec upload")],
        [cell("Annonces et communication interne"),
         cell("<font color='#059669'><b>Oui</b></font> — Module Annonces avec audience ciblée")],
        [cell("Notifications multicanal (email, SMS, push)"),
         cell("<font color='#059669'><b>Oui</b></font> — Infrastructure en place")],
    ]
    t = Table(covered, colWidths=[8 * cm, 8 * cm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t)

    story.append(Spacer(1, 0.5 * cm))
    story.append(p(
        "<b>Bilan flexibilité</b> : le squelette est très bon. La majorité "
        "des pays UEMOA/CEMAC sont couverts au niveau modèle de données.",
        'Note',
    ))

    story.append(PageBreak())

    # ==== 3. ANGLES MORTS CRITIQUES ====
    story.append(p("3. Angles morts critiques", 'H1'))

    story.append(p("3.1 Bloquants — sans ces fonctionnalités, l'adoption est difficile", 'H2'))
    bloquants = [
        [cell("<b>#</b>"), cell("<b>Lacune</b>"), cell("<b>Pays/zone</b>"), cell("<b>Impact</b>")],
        [cell("1", 'CellSmall'),
         cell("Pas d'intégration Mobile Money (Wave, Orange, MTN, Moov, Airtel)", 'CellSmall'),
         cell("Toute la zone", 'CellSmall'),
         cell("Sans ça, on reste sur du cash → adoption urbaine seulement", 'CellSmall')],
        [cell("2", 'CellSmall'),
         cell("Pas de fréquence « quotidienne »", 'CellSmall'),
         cell("Bénin, Togo, CI, Congo", 'CellSmall'),
         cell("Modèle dominant en zone urbaine ouest-africaine", 'CellSmall')],
        [cell("3", 'CellSmall'),
         cell("Pas de rôle « Collecteur/Ramasseur » avec commission", 'CellSmall'),
         cell("Bénin, Togo, CI", 'CellSmall'),
         cell("Business model des tontines à collecteur (à formaliser)", 'CellSmall')],
        [cell("4", 'CellSmall'),
         cell("Pas de multi-langue au-delà du fr/en", 'CellSmall'),
         cell("Sénégal (wolof), Mali (bambara), Congo (lingala), Tchad (arabe)", 'CellSmall'),
         cell("Animation séances et notifications SMS en langue locale", 'CellSmall')],
    ]
    t = Table(bloquants, colWidths=[0.7 * cm, 5 * cm, 4 * cm, 6.3 * cm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), RED),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)

    story.append(Spacer(1, 0.4 * cm))
    story.append(p("3.2 Importants — manquants pour 30 à 50 % des usages", 'H2'))
    importants = [
        [cell("<b>#</b>"), cell("<b>Lacune</b>"), cell("<b>Pays/zone</b>"), cell("<b>Solution proposée</b>")],
        [cell("5", 'CellSmall'),
         cell("Tontines à objectif (Tabaski, Hajj, mariage, scolarité, funérailles)", 'CellSmall'),
         cell("Sénégal, Mali, Niger, Tchad", 'CellSmall'),
         cell("Champs <i>purpose</i> / <i>target_amount</i> / <i>target_date</i> sur TontineType", 'CellSmall')],
        [cell("6", 'CellSmall'),
         cell("Fonds de solidarité automatique (décès, hospitalisation)", 'CellSmall'),
         cell("Toute la zone", 'CellSmall'),
         cell("Prélèvement systématique + déblocage automatique sur événement", 'CellSmall')],
        [cell("7", 'CellSmall'),
         cell("Système de garants / caution croisée", 'CellSmall'),
         cell("Sénégal (mbotaye), CI", 'CellSmall'),
         cell("Étendre <i>Loan.guarantors</i> à <i>Contribution</i> ; chaîne de cautions", 'CellSmall')],
        [cell("8", 'CellSmall'),
         cell("Calendrier islamique / lunaire pour rappels", 'CellSmall'),
         cell("Sénégal, Mali, Niger, Tchad", 'CellSmall'),
         cell("Lib de conversion hégirien + notifications fêtes religieuses", 'CellSmall')],
        [cell("9", 'CellSmall'),
         cell("Cotisation en nature (riz, mil, sorgho)", 'CellSmall'),
         cell("Niger, Tchad, zones rurales", 'CellSmall'),
         cell("Champ <i>Contribution.in_kind_items</i> (JSON) + équivalent monétaire", 'CellSmall')],
        [cell("10", 'CellSmall'),
         cell("Signature numérique / présence visuelle des PV", 'CellSmall'),
         cell("Toute la zone", 'CellSmall'),
         cell("Image signature base64 ; export PDF imprimable", 'CellSmall')],
        [cell("11", 'CellSmall'),
         cell("Transferts diaspora", 'CellSmall'),
         cell("Sénégal, CI, Mali (très important)", 'CellSmall'),
         cell("Module séparé : transferts entrants avec source (Western Union, Wave)", 'CellSmall')],
        [cell("12", 'CellSmall'),
         cell("Mode hors-ligne (saisie séance puis synchronisation)", 'CellSmall'),
         cell("Tous (couverture réseau aléatoire)", 'CellSmall'),
         cell("PWA + IndexedDB côté mobile", 'CellSmall')],
    ]
    t = Table(importants, colWidths=[0.7 * cm, 4.5 * cm, 4 * cm, 6.8 * cm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), AMBER),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)

    story.append(Spacer(1, 0.4 * cm))
    story.append(p("3.3 Souhaitables — qualité de vie / différenciation", 'H2'))
    souhaitables = [
        [cell("<b>#</b>"), cell("<b>Lacune</b>"), cell("<b>Bénéfice</b>")],
        [cell("13", 'CellSmall'), cell("Carte de membre PDF imprimable", 'CellSmall'), cell("Identifiant social, prestige", 'CellSmall')],
        [cell("14", 'CellSmall'), cell("Quitus annuel automatique (décharge trésorier)", 'CellSmall'), cell("Conformité interne, fin de mandat", 'CellSmall')],
        [cell("15", 'CellSmall'), cell("Registre de présence imprimable", 'CellSmall'), cell("Conformité statutaire", 'CellSmall')],
        [cell("16", 'CellSmall'), cell("WhatsApp Business officiel (templates)", 'CellSmall'), cell("Canal #1 en Afrique francophone", 'CellSmall')],
        [cell("17", 'CellSmall'), cell("Tontines transfrontalières", 'CellSmall'), cell("Diaspora ↔ origine, multi-devises", 'CellSmall')],
        [cell("18", 'CellSmall'), cell("Tontines de prestige (montants élevés)", 'CellSmall'), cell("Élite urbaine, oligarchie", 'CellSmall')],
        [cell("19", 'CellSmall'), cell("Tontines salariales (paiement à la source)", 'CellSmall'), cell("Gabon, Congo, fonctionnaires", 'CellSmall')],
        [cell("20", 'CellSmall'), cell("Visualisation arbre des cautions", 'CellSmall'), cell("Lecture rapide pour le bureau", 'CellSmall')],
    ]
    t = Table(souhaitables, colWidths=[0.7 * cm, 9 * cm, 6.3 * cm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), YELLOW),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)

    story.append(PageBreak())

    # ==== 4. ADÉQUATION PAR PAYS ====
    story.append(p("4. Adéquation pays par pays", 'H1'))
    story.append(p(
        "Note d'adéquation sur 10 basée sur l'état actuel du projet "
        "et les pratiques locales dominantes.",
        'Body',
    ))

    adeq = [
        [cell("<b>Pays</b>"), cell("<b>Note</b>"), cell("<b>Verdict</b>")],
        [cell("Gabon, Congo Brazza, Guinée Éq. (salariés / formels)"),
         cell("<b><font color='#059669'>8/10</font></b>"),
         cell("Adapté quasi tel quel. Manque essentiellement Mobile Money.")],
        [cell("Côte d'Ivoire, Sénégal (urbain)"),
         cell("<b><font color='#059669'>7/10</font></b>"),
         cell("Très utilisable. Ajouter Mobile Money + daily + collecteur.")],
        [cell("Mali, Burkina Faso (urbain)"),
         cell("<b><font color='#059669'>7/10</font></b>"),
         cell("Idem. Ajouter wolof/bambara pour les notifs SMS.")],
        [cell("Bénin, Togo"),
         cell("<b><font color='#CA8A04'>5/10</font></b>"),
         cell("Bloquant : tontine quotidienne à collecteur dominante, manquante.")],
        [cell("Niger, Tchad (rural)"),
         cell("<b><font color='#D97706'>4/10</font></b>"),
         cell("Versement nature + langue locale + calendrier islamique manquent.")],
        [cell("Centrafrique"),
         cell("<b><font color='#059669'>6/10</font></b>"),
         cell("OK pour zones urbaines pacifiées.")],
        [cell("Guinée-Bissau"),
         cell("<b><font color='#DC2626'>3/10</font></b>"),
         cell("Lusophone, base utilisateurs faible, priorité basse.")],
    ]
    t = Table(adeq, colWidths=[5 * cm, 2 * cm, 9 * cm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t)

    story.append(Spacer(1, 0.5 * cm))
    story.append(p(
        "<b>Lecture</b> : les pays salariés/formels (Gabon, Congo) sont quasi "
        "prêts à utiliser TontineX360 en l'état. À l'opposé, les pays à "
        "tradition de collecteur quotidien (Bénin, Togo) nécessitent des ajouts "
        "structurels avant déploiement.",
        'Note',
    ))

    story.append(PageBreak())

    # ==== 5. ROADMAP ====
    story.append(p("5. Roadmap d'adaptation priorisée", 'H1'))

    story.append(p("Phase 1 — Quick wins (1 à 2 semaines)", 'H2'))
    for item in [
        "Ajouter <b>DAILY</b> à <i>Cycle.Frequency</i> (le modèle existe, ajouter le choice et adapter <i>generate_sessions_for_cycle</i>)",
        "Champ <b>purpose</b> sur <i>TontineType</i> (<i>hajj</i>, <i>tabaski</i>, <i>wedding</i>, <i>funeral</i>, <i>school</i>, <i>business</i>, <i>general</i>)",
        "Champ <b>commission_rate</b> sur <i>TontineType</i> pour le modèle collecteur (X % gardé par cycle)",
        "Rôle système par défaut <b>« Collecteur »</b> dans le signal <i>create_default_config</i> avec permission <i>finance.collect_door_to_door</i>",
        "Validation téléphone multi-pays renforcée dans le composant <i>PhoneInput</i> (22 pays déjà gérés)",
    ]:
        story.append(bullet(item))

    story.append(p("Phase 2 — Différenciants (1 mois)", 'H2'))
    for item in [
        "Module <b>Mobile Money</b> : orchestrateur + adapters Wave / Orange / MTN / Moov / Airtel",
        "<b>Tontines à objectif</b> (<i>target_amount</i>, <i>target_date</i>, déblocage auto)",
        "<b>Fonds de solidarité</b> (cotisation pré-prélevée + événements déclencheurs)",
        "<b>WhatsApp Business</b> officiel (templates approuvés)",
        "Multi-langue : extraction des chaînes + traductions wolof, bambara, lingala, arabe",
    ]:
        story.append(bullet(item))

    story.append(p("Phase 3 — Excellence (2 à 3 mois)", 'H2'))
    for item in [
        "<b>PWA hors-ligne</b> avec synchronisation différée",
        "<b>Module diaspora</b> (transferts entrants tracés)",
        "Signature numérique sur PV et payouts",
        "Calendrier islamique avec notifications Tabaski / Aïd / Maouloud",
        "Exports PDF : carte membre, registre présence, PV signé, quitus annuel",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())

    # ==== 6. RECOMMANDATION STRATÉGIQUE ====
    story.append(p("6. Recommandation stratégique", 'H1'))

    story.append(p(
        "<b>Le projet est solide architecturalement.</b> Le multi-tenant, "
        "la flexibilité des settings JSON, les rôles configurables, plusieurs "
        "cotisations en parallèle et les six méthodes d'attribution couvrent "
        "environ <b>70 % des besoins</b> dans la zone UEMOA/CEMAC. Cette "
        "fondation est rare et constitue un atout compétitif majeur.",
        'Body',
    ))

    story.append(p(
        "Cependant, pour passer de « bon projet technique » à « produit qui "
        "dégage de la traction », il manque les <b>4 bloquants</b> suivants :",
        'Body',
    ))

    bloq = [
        ("Mobile Money", "Condition n°1 d'adoption sur tout le marché informel"),
        ("Fréquence quotidienne + rôle collecteur",
         "Clé de la pénétration au Bénin, Togo et Côte d'Ivoire urbain — soit un marché potentiel de plusieurs millions d'utilisateurs"),
        ("Multi-langue (wolof, bambara, lingala, arabe)",
         "Signal fort de respect culturel, démultiplie l'adoption rurale"),
        ("Tontines à objectif (Tabaski, Hajj, mariage, funérailles)",
         "Correspond à 40-60 % des tontines réellement pratiquées"),
    ]
    for i, (label, why) in enumerate(bloq, 1):
        story.append(p(f"<b>{i}. {label}</b> — {why}", 'Body'))

    story.append(Spacer(1, 0.3 * cm))
    story.append(p(
        "Ces quatre ajouts représentent <b>4 à 6 semaines de travail</b> et "
        "transformeraient le projet d'<i>outil pour bureau formel d'association</i> "
        "en <b>plateforme pour l'économie sociale africaine</b>.",
        'Body',
    ))

    story.append(Spacer(1, 0.5 * cm))

    # Encart final
    encart = Table([[p(
        "<b>Conclusion.</b> TontineX360 dispose d'une assise technique "
        "remarquable et d'une flexibilité réelle. L'investissement à consentir "
        "pour adresser pleinement la zone UEMOA/CEMAC est concentré sur "
        "4 axes courts. Le retour sur investissement est asymétrique : ces "
        "ajouts ouvrent des marchés massivement plus larges (zone informelle, "
        "tontines à collecteur, marchés ruraux) sans remettre en cause "
        "l'architecture existante.",
        'Body',
    )]], colWidths=[16 * cm])
    encart.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFF3E8')),
        ('BOX', (0, 0), (-1, -1), 1, ORANGE),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(encart)

    story.append(Spacer(1, 1 * cm))
    story.append(p(
        "— Fin du rapport —",
        'Note',
    ))

    return story


# =============================================================================
# Génération
# =============================================================================

def _on_page(canvas, doc):
    """Footer avec numéro de page."""
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(GRAY)
    canvas.drawString(2 * cm, 1.5 * cm, "TontineX360 — Analyse comparative UEMOA/CEMAC")
    canvas.drawRightString(
        A4[0] - 2 * cm, 1.5 * cm,
        f"Page {doc.page}",
    )
    canvas.restoreState()


def generate():
    output_path = "/app/ANALYSE_UEMOA_CEMAC.pdf"
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2.5 * cm,
        title="Analyse comparative UEMOA/CEMAC — TontineX360",
        author="Équipe TontineX360",
    )
    doc.build(build_story(), onFirstPage=_on_page, onLaterPages=_on_page)
    print(f"✓ PDF généré : {output_path}")


if __name__ == "__main__":
    generate()
