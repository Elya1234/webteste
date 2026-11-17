import { useEffect, useState } from "react";
import { EMPTY_ASSOCIATION, getAssociation, type Association } from "../lib/backend";
import { useSynagogue } from "../lib/synagogue";

/* Pages exigées par l'App Store, le Play Store et la loi (RGPD, vente à distance).
 * Le nom, l'adresse et le contact viennent de la fiche de l'association (Administration › Association). */
function useAsso() {
  const [a, setA] = useState<Association>(EMPTY_ASSOCIATION);
  useEffect(() => { getAssociation().then(setA, () => {}); }, []);
  return a;
}
const Who = ({ a, name }: { a: Association; name: string }) => (
  <p><b>{a.legal_name || name}</b>{a.address && <>, {a.address}, {a.postal_code} {a.city}</>}{a.rna && <> · RNA {a.rna}</>}{a.siret && <> · SIRET {a.siret}</>}
    {a.email && <><br />Contact : <span className="gold">{a.email}</span></>}{a.phone && <> · {a.phone}</>}</p>
);

export function Confidentialite() {
  const a = useAsso(); const { config } = useSynagogue();
  return (
    <div className="page narrow"><article className="card legal">
      <h1 className="serif gold-text">Politique de confidentialité</h1>
      <p className="small muted">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>
      <h2>Qui est responsable de vos données ?</h2><Who a={a} name={config.name} />
      <h2>Ce que nous enregistrons</h2>
      <ul>
        <li><b>Votre compte</b> : prénom, nom, e-mail, téléphone (facultatif), adresse (facultative, pour les reçus fiscaux). Le mot de passe n'est jamais lisible : seule une empreinte chiffrée est conservée.</li>
        <li><b>Vos dons et achats</b> : montant, motif, dédicace, articles, date, état du paiement. Les numéros de carte et d'IBAN sont saisis chez notre prestataire de paiement Stripe et ne nous sont jamais transmis.</li>
        <li><b>Vos messages</b> avec l'administration de la synagogue.</li>
        <li><b>Sur votre téléphone</b> : une copie des horaires, du calendrier et des prières ouvertes, pour l'utilisation sans Internet. Aucune publicité, aucun traçage, aucun outil de mesure d'audience.</li>
      </ul>
      <h2>Pourquoi</h2>
      <p>Gérer votre compte, encaisser vos dons et achats, vous envoyer vos reçus (et reçus fiscaux), répondre à vos messages et vous informer de la vie de la communauté. Base légale : l'exécution de vos demandes et nos obligations comptables.</p>
      <h2>Qui y a accès</h2>
      <p>Uniquement l'administration de la synagogue, et nos prestataires techniques, qui les traitent pour notre compte : Supabase (hébergement des données, Union européenne), Stripe (paiement). Vos données ne sont jamais vendues ni prêtées.</p>
      <h2>Combien de temps</h2>
      <p>Tant que votre compte existe. Les dons et paiements sont conservés 10 ans (obligation comptable), même après la suppression du compte, sans lien avec celui-ci.</p>
      <h2>Vos droits</h2>
      <p>Vous pouvez consulter et corriger vos informations dans Mon compte, et <b>supprimer votre compte</b> à tout moment (Mon compte › Supprimer mon compte). Pour toute autre demande (accès, opposition, portabilité), écrivez-nous{a.email && <> à <span className="gold">{a.email}</span></>}. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
    </article></div>
  );
}

export function Conditions() {
  const a = useAsso(); const { config } = useSynagogue();
  return (
    <div className="page narrow"><article className="card legal">
      <h1 className="serif gold-text">Conditions de vente et de don</h1>
      <h2>Vendeur et bénéficiaire</h2><Who a={a} name={config.name} />
      <h2>Articles et prix</h2>
      <p>Les articles de la boutique sont décrits avec leur référence et leur prix en euros, toutes taxes comprises. La commande est confirmée après le paiement ; un reçu est disponible dans Mon compte.</p>
      <h2>Paiement</h2>
      <p>Par carte bancaire, Apple Pay, Google Pay ou prélèvement SEPA, sur la page sécurisée de Stripe. Un prélèvement SEPA est confirmé par la banque sous 3 à 5 jours.</p>
      <h2>Retrait ou livraison</h2>
      <p>Les articles sont à retirer à la synagogue, sauf accord différent avec l'administration (écrivez-nous depuis Mon compte › Messages).</p>
      <h2>Rétractation</h2>
      <p>Pour un objet, vous disposez de 14 jours après sa remise pour changer d'avis : il est remboursé s'il est rendu intact. Ce droit ne s'applique pas aux articles personnalisés à votre demande (dédicace, plaque gravée), conformément à l'article L221-28 du code de la consommation.</p>
      <h2>Dons</h2>
      <p>Un don est définitif. Un don mensuel s'arrête à tout moment depuis Mon compte › Mes dons mensuels ; les mois déjà versés restent acquis. En cas d'erreur de montant, contactez-nous rapidement.</p>
      {a.tax_receipts && <><h2>Reçus fiscaux</h2><p>Les dons ouvrent droit à une réduction d'impôt (article 200 du CGI). Le reçu fiscal est disponible depuis le reçu de chaque don, une fois votre adresse renseignée dans Mon compte.</p></>}
      <h2>Réclamations</h2>
      <p>Écrivez-nous depuis Mon compte › Messages{a.email && <> ou à <span className="gold">{a.email}</span></>}. Médiation de la consommation : plateforme européenne ec.europa.eu/consumers/odr.</p>
    </article></div>
  );
}
