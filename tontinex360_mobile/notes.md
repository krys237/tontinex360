# Journal de Bord & Guide de Style — TontineX360 Mobile

Ce document enregistre les décisions de design et les règles de style établies pour rendre l'application mobile **TontineX360** moins « générative » (générique/basique) et plus **professionnelle, propre et premium**.

Tous les agents et développeurs travaillant sur cette base de code doivent strictement suivre ces consignes.

---

## 1. Règle des Insignes d'Initiales & Icônes (Badges)

Partout où l'application affiche des initiales d'association ou des icônes de catégorie, nous appliquons un style épuré et cohérent basé sur le blanc et le vert :

### Spécification Technique du Badge :
* **Couleur de fond :** Fond blanc pur (`colors.white`).
* **Bordure :** 1px d'épaisseur, couleur verte principale de la marque (`colors.primary`, `#43793F`).
* **Contenu (Texte ou Icône) :** Toujours coloré en vert principal de la marque (`colors.primary`, `#43793F`).
* **Formes autorisées :**
  1. **Carré arrondi (Default Lists) :** Pour les logos d'associations dans les listes ou sélecteurs (ex. [ChooseAssociationScreen.tsx](file:///d:/Test/Native/tontinex360/tontinex360_mobile/src/screens/workspace/ChooseAssociationScreen.tsx)).
     * Code : `{ borderRadius: radius.md }` (12px).
  2. **Cercle (Profile / Avatars) :** Pour les avatars de membres ou les boutons d'icônes ronds (ex. [NoAssociationScreen.tsx](file:///d:/Test/Native/tontinex360/tontinex360_mobile/src/screens/workspace/NoAssociationScreen.tsx)).
     * Code : `{ borderRadius: size / 2 }` ou `{ borderRadius: radius.pill }` (999px).

---

## 2. Refonte du Formulaire de Connexion (Login)
* **Aération du formulaire :** Les messages de réassurance secondaires ou les informations d'architecture (ex. *« Architecture non-custodial »*) ne doivent pas encombrer la carte principale d'identification.
* **Badge de confiance :** Placer ces informations en dessous de la carte principale sous forme de badge discret :
  * Fond transparent (hérite du dégradé).
  * Bordure verte principale (`colors.primary`).
  * Texte explicatif centré, de petite taille (`font.size.xs`), avec une hauteur de ligne aérée (`lineHeight: 16`).

---

## 3. Transformation des Listes d'Actions (Layout)
* **Proscrire les blocs verticaux disparates :** Éviter les grandes cartes verticales de couleurs différentes (vert, bleu, jaune) empilées les unes sur les autres, qui donnent un effet désordonné et lourd.
* **Adopter les Tuiles Horizontales (Sleek Rows) :**
  * Fond blanc, bordure fine (`colors.border`), ombre portée douce (`...cardShadow`).
  * Organisation interne :
    * **À gauche :** `IconBubble` avec `tint="white"` (cercle blanc, bordure verte, icône verte).
    * **Au centre :** Titre en gras (`colors.text`) + description courte en gris (`colors.textMuted`).
    * **À droite :** Un chevron de navigation (`chevron-forward`, couleur `colors.textLight`).
  * **Interactions intelligentes :** Pour les choix informatifs (ex. *« J'ai un lien d'invitation »*), plutôt que d'afficher un gros pavé de texte d'instructions à l'écran, transformer la tuile en bouton cliquable qui ouvre une boîte de dialogue native propre (`Alert.alert`) expliquant la procédure à l'utilisateur.

---

## 4. Nuancier & Typographie (Rappels)
* **Background :** Dégradé menthe douce (`colors.bgGradientTop`) vers blanc (`colors.bgGradientBottom`).
* **Textes :** Principal en bleu-vert très foncé (`colors.text`, `#1E3233`) ; secondaires en gris (`colors.textMuted`, `#707070`).
* **Transitions :** Toujours adoucir les retours haptiques ou les états pressés (`opacity: 0.85`).
