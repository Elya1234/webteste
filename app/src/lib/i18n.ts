/* Français / anglais. Le texte français sert de clé : t("Accueil") → "Home" en anglais.
 * Une phrase sans traduction s'affiche en français (jamais de trou à l'écran). */
import { read, write } from "./storage";

export type Lang = "fr" | "en";
const K = "app.lang";
// toujours en français au départ ; l'anglais seulement si la personne le choisit (Menu ou Compte › English)
let lang: Lang = read<Lang>(K) || "fr";
const subs = new Set<() => void>();

export const getLang = () => lang;
export function setLang(l: Lang) { lang = l; write(K, l); document.documentElement.lang = l; subs.forEach((f) => f()); }
export const onLang = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** Langue des dates et des montants */
export const loc = () => (lang === "en" ? "en-GB" : "fr-FR");
if (typeof document !== "undefined") document.documentElement.lang = lang;

export function t(fr: string, vars?: Record<string, string | number>): string {
  let s = lang === "en" ? EN[fr] ?? fr : fr;
  if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.split("{" + k + "}").join(String(v)); });
  return s;
}

const EN: Record<string, string> = {
  // navigation
  "Accueil": "Home", "Horaires": "Times", "Boutique": "Shop", "Compte": "Account", "Menu": "Menu", "Fermer": "Close", "Dons": "Donate",
  "‹ Menu": "‹ Menu", "Panier": "Cart", "Rechercher": "Search", "Rechercher une rubrique": "Search a section", "Aucune rubrique trouvée.": "No section found.",
  "Espace administrateur": "Administration", "Langue": "Language",
  // menu
  "Offices de la synagogue": "Synagogue prayer times", "Siddour": "Siddur", "Rite séfarade (Edot HaMizrah)": "Sephardic rite (Edot HaMizrach)",
  "Calendrier": "Calendar", "Calendrier juif, fêtes, Roch Hodech": "Jewish calendar, holidays, Rosh Chodesh", "Zmanim": "Zmanim",
  "Heures halakhiques du jour": "Today's halachic times", "Cours à la synagogue": "Classes at the synagogue", "Programme des cours": "Class schedule",
  "Halakha Yomit": "Daily Halacha", "Choulhan Aroukh du jour": "Today's Shulchan Aruch", "Cours en vidéo": "Video classes", "Cours filmés": "Recorded classes",
  "Daf Hayomi": "Daf Yomi", "La page de Guemara du jour": "Today's page of Talmud", "Galerie": "Gallery", "Photos de la synagogue": "Synagogue photos",
  "Livres, objets, dédicaces": "Books, items, dedications", "Don, cotisation, kibboud": "Donation, membership, kibbud",
  // accueil
  "Prochain office": "Next prayer", "Hors connexion : dernières données enregistrées.": "Offline: showing the last saved data.",
  "Offices": "Prayers", "Les offices des jours suivants": "Prayer times for the coming days", "Chabbat": "Shabbat", "Entrée": "Candle lighting", "Sortie": "Havdalah",
  "Annonces": "Announcements", "Aucune annonce pour le moment.": "No announcements at the moment.", "Soutenir la synagogue": "Support the synagogue",
  "Don, cotisation, kibboud, dédicace.": "Donation, membership, kibbud, dedication.", "Faire un don": "Donate", "Tous ›": "All ›",
  "Hanetz": "Sunrise", "Fin du Chema": "Latest Shema", "Chkia": "Sunset", "Tsét": "Nightfall", "Mis à jour le {d}": "Updated {d}", " · hors connexion": " · offline",
  "Aujourd'hui · ": "Today · ", "Demain · ": "Tomorrow · ", "Semaine": "Weekdays", "Vendredi": "Friday", " · aujourd'hui": " · today", "Sortie de Chabbat": "End of Shabbat",
  // horaires / zmanim
  "Auj.": "Today", "Pas d'horaires pour ce jour.": "No times for this day.", "Zmanim de ce jour": "Zmanim for this day",
  "Horaires indisponibles : en attente de Hebcal…": "Times unavailable: waiting for Hebcal…", "Méthodes de calcul à faire valider par le Rav.": "Calculation methods to be confirmed by the Rav.",
  // calendrier
  "Mois précédent": "Previous month", "Mois suivant": "Next month", "Fête": "Holiday", "Roch Hodech": "Rosh Chodesh", "Jeûne": "Fast", "Paracha": "Parasha",
  "Rien de particulier ce jour-là.": "Nothing special on this day.", "Chargement du calendrier…": "Loading the calendar…",
  // étude
  "Le Choulhan Aroukh de Maran Rabbi Yossef Karo, quelques paragraphes chaque jour.": "The Shulchan Aruch of Maran Rabbi Yosef Karo, a few paragraphs every day.",
  "Texte original": "Original text", "Traduction (anglais)": "English translation", "Chargement…": "Loading…", "Texte : Sefaria.org": "Text: Sefaria.org",
  "Pas de connexion : la lecture du jour n'a pas pu être chargée.": "No connection: today's reading could not be loaded.",
  // siddour
  "Rite séfarade, nossah Edot Hamizrah.": "Sephardic rite, nusach Edot HaMizrach.", "À prier maintenant": "To pray now", "{n} parties": "{n} sections",
  "{n} prières": "{n} prayers", "Lire": "Read", "Fêtes et mois": "Holidays and months", "Bénédictions": "Blessings",
  "Texte : Sefaria.org (domaine public). Chaque prière ouverte reste lisible sans Internet.": "Text: Sefaria.org (public domain). Every prayer you open stays readable offline.",
  "Chargement du Siddour…": "Loading the Siddur…", "‹ Précédent": "‹ Previous", "Suivant ›": "Next ›", "Taille du texte": "Text size",
  "Texte plus petit": "Smaller text", "Texte plus grand": "Larger text",
  "Pas de connexion : ouvrez le Siddour une première fois avec Internet, il restera ensuite disponible.": "No connection: open the Siddur once while online, it will then stay available.",
  "Pas de connexion : cette prière n'a pas encore été enregistrée sur l'appareil.": "No connection: this prayer has not been saved on this device yet.",
  // contenus
  "Aucun cours annoncé.": "No classes announced.", "Autres": "Other", "Les vidéos des cours seront bientôt ajoutées ici.": "Class videos will be added here soon.",
  "Impossible de charger. Vérifiez votre connexion.": "Could not load. Check your connection.",
  // boutique
  "Rechercher (nom ou référence)": "Search (name or reference)", "Tout": "All", "Réf. {r}": "Ref. {r}", "Épuisé": "Sold out", "Ajouter": "Add",
  "Aucun article trouvé.": "No item found.", "Annuler": "Cancel", "Ajouter au panier": "Add to cart", "« {n} » ajouté · Voir le panier": "“{n}” added · View cart",
  "Impossible de charger la boutique. Vérifiez votre connexion.": "Could not load the shop. Check your connection.",
  "Votre panier est vide.": "Your cart is empty.", "Voir la boutique": "Browse the shop", "Total": "Total", "Moins": "Less", "Plus": "More",
  "Un compte est nécessaire pour payer : vous retrouverez vos commandes et reçus.": "An account is needed to pay: you will find your orders and receipts there.",
  "Mode démonstration : aucun paiement réel.": "Demo mode: no real payment.", "Payer {m}": "Pay {m}", "Ouverture du paiement…": "Opening payment…",
  "Créer un compte ou se connecter": "Create an account or sign in", "Le paiement n'a pas pu démarrer. Réessayez dans un instant.": "The payment could not start. Please try again shortly.",
  // dons
  "Motif": "Purpose", "Montant": "Amount", "Autre montant (€)": "Other amount (€)", "Dédicace (facultatif)": "Dedication (optional)",
  "Ex. Leilouy Nichmat …, Refoua Chelema de …": "E.g. Leilui Nishmat …, Refua Shelema for …", "Donner {m}": "Give {m}",
  "Un reçu est envoyé par e-mail après le paiement.": "A receipt is emailed after payment.", "Fréquence": "Frequency", "Une fois": "Once", "Chaque mois": "Monthly",
  "Donner {m} par mois": "Give {m} per month", "Arrêtable à tout moment depuis votre compte.": "You can stop it at any time from your account.",
  "Don général": "General donation", "Cotisation annuelle": "Annual membership", "Kibboud / Mitsva (montée à la Torah)": "Kibbud / Mitzvah (Torah honour)", "Neder": "Neder (pledge)",
  "Hazkara / Leilouy Nichmat": "Memorial / Leilui Nishmat", "Refoua Chelema": "Refua Shelema", "Kiddouch / Séouda": "Kiddush / Seuda",
  // compte
  "Créer un compte": "Create an account", "Se connecter": "Sign in", "Connectez-vous pour continuer vers le paiement.": "Sign in to continue to payment.",
  "Prénom": "First name", "Nom": "Last name", "E-mail": "Email", "Téléphone (facultatif)": "Phone (optional)", "Mot de passe": "Password",
  "Créer mon compte": "Create my account", "Mot de passe oublié ?": "Forgot password?", "Mode démonstration : le compte reste sur cet appareil.": "Demo mode: the account stays on this device.",
  "Une fois connecté, vous le restez sur cet appareil jusqu'à ce que vous vous déconnectiez.": "Once signed in, you stay signed in on this device until you sign out.",
  "Compte créé. Ouvrez l'e-mail reçu pour le confirmer, puis connectez-vous.": "Account created. Open the email you received to confirm it, then sign in.",
  "E-mail ou mot de passe incorrect.": "Wrong email or password.", "Un compte existe déjà avec cet e-mail : connectez-vous.": "An account already exists with this email: sign in.",
  "Une erreur est survenue. Réessayez.": "Something went wrong. Please try again.", "Écrivez d'abord votre e-mail.": "Enter your email first.",
  "Si un compte existe, un e-mail pour changer le mot de passe vient d'être envoyé.": "If an account exists, an email to reset the password has just been sent.",
  "Mon compte": "My account", "Téléphone": "Phone", "Enregistré": "Saved", "Enregistrer": "Save", "Mes commandes et dons": "My orders and donations",
  "Rien pour le moment.": "Nothing yet.", "Se déconnecter": "Sign out", "Supprimer mon compte": "Delete my account", "Don · ": "Donation · ", "Boutique · ": "Shop · ",
  "En attente": "Pending", "Payé": "Paid", "Annulé": "Cancelled", "Remboursé": "Refunded",
  "Merci ! Votre paiement est bien enregistré. Tizkou lemitsvot.": "Thank you! Your payment has been recorded. Tizku lemitzvot.",
  "Paiement annulé : rien n'a été prélevé.": "Payment cancelled: nothing was charged.", "Confirmer la suppression": "Confirm deletion",
  "Supprimer définitivement votre compte ? Vos reçus déjà envoyés restent valables.": "Delete your account permanently? Receipts already sent remain valid.",
  "Messages": "Messages", "Écrire à l'administration, rappels, annonces": "Write to the office, reminders, announcements",
  "Mes dons mensuels": "My monthly donations", "Gérer mes dons mensuels et cartes": "Manage my monthly donations and cards", "par mois": "per month",
  "Reçu": "Receipt",
  // messages
  "‹ Mon compte": "‹ My account", "Votre conversation privée avec l'administration de la synagogue.": "Your private conversation with the synagogue office.",
  "Aucun message pour le moment. Écrivez ci-dessous : l'administration vous répondra ici.": "No messages yet. Write below: the office will reply here.",
  "Rappel de paiement": "Payment reminder", "Message à la communauté": "Message to the community", " · Lu": " · Read", " · Envoyé": " · Sent",
  "Écrire à l'administration…": "Write to the office…", "Envoyer": "Send", "Message non envoyé. Vérifiez votre connexion.": "Message not sent. Check your connection.",
  "Connectez-vous pour écrire à l'administration et recevoir ses messages.": "Sign in to write to the office and receive its messages.",
  "Se connecter ou créer un compte": "Sign in or create an account",
  // paiement de démonstration
  "Paiement sécurisé": "Secure payment", "Carte bancaire": "Card", "Prélèvement SEPA": "SEPA direct debit", "Numéro de carte": "Card number",
  "Expiration": "Expiry", "Cryptogramme": "CVC", "Démonstration : utilisez la carte 4242 4242 4242 4242, aucune somme n'est prélevée.": "Demo: use card 4242 4242 4242 4242, nothing is charged.",
  "Paiement en cours…": "Processing…", "Carte refusée. Essayez la carte de test 4242 4242 4242 4242.": "Card declined. Try the test card 4242 4242 4242 4242.",
  "Retour": "Back", "Reçu introuvable.": "Receipt not found.", "Reçu d'achat": "Purchase receipt", "Reçu de don": "Donation receipt", "Pour": "For",
  "Désignation": "Item", "Qté": "Qty", "Moyen de paiement": "Payment method", "État": "Status", "Reçu Stripe": "Stripe receipt",
  "Ce reçu atteste du paiement. Il ne constitue pas un reçu fiscal.": "This receipt confirms the payment. It is not a tax receipt.",
  "Imprimer ou enregistrer en PDF": "Print or save as PDF", "La boutique sera bientôt ouverte.": "The shop will open soon.", "Les photos seront bientôt ajoutées ici.": "Photos will be added here soon.", "Pays": "Country", "Numéro valide": "Valid number", "France : 10 chiffres": "France: 10 digits", "États-Unis / Canada : 10 chiffres": "US / Canada: 10 digits",
  "Numéro français : 10 chiffres, par exemple 06 12 34 56 78.": "French number: 10 digits, e.g. 06 12 34 56 78.",
  "Numéro américain : 10 chiffres, par exemple (212) 555-0123.": "US number: 10 digits, e.g. (212) 555-0123.",
  "Masquer le mot de passe": "Hide password", "Afficher le mot de passe": "Show password", "Masquer": "Hide", "Afficher": "Show", "Solidité": "Strength",
  "Très faible": "Very weak", "Faible": "Weak", "Moyen": "Fair", "Solide": "Strong", "Très solide": "Very strong",
  "10 caractères minimum": "At least 10 characters", "Une minuscule et une majuscule": "A lowercase and an uppercase letter", "Au moins un chiffre": "At least one digit",
  "Ni votre nom ni votre e-mail, ni un mot trop courant": "Not your name or email, nor a common word",
  "Le mot de passe ne respecte pas les règles ci-dessous.": "The password does not meet the rules below.", "Vérifiez le numéro de téléphone.": "Check the phone number.",
  "Trop d'essais. Réessayez dans quelques minutes.": "Too many attempts. Try again in a few minutes.", "Confirmez votre adresse e-mail avant de vous connecter.": "Confirm your email address before signing in.", "Rien à payer.": "Nothing to pay.", "mois": "month", "Vérifiez les informations de la carte.": "Check the card details.",
  "Vérifiez l'IBAN et le titulaire.": "Check the IBAN and account holder.", "Le prélèvement est confirmé par la banque en 3 à 5 jours.": "The bank confirms the debit within 3 to 5 days.",
  "Prélèvement en cours": "Debit in progress", "Échoué": "Failed", "Arrêter": "Stop", "Gérer": "Manage", "depuis le {d}": "since {d}",
  "Merci ! Le prélèvement est en cours : il sera confirmé par la banque d'ici quelques jours.": "Thank you! The debit is in progress: the bank will confirm it within a few days.", "IBAN": "IBAN", "Titulaire du compte": "Account holder", "Payer avec Apple Pay": "Pay with Apple Pay", "Payer avec Google Pay": "Pay with Google Pay"
};
