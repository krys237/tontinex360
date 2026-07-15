import React from 'react';

import { appVersionApi, type AppVersionInfo } from '../lib/api/app-version';
import { APP_VERSION } from '../config/env';
import { compareVersions, isOutdated } from '../lib/utils/version';
import UpdateAvailableModal from './UpdateAvailableModal';

/**
 * Vérifie au démarrage si une version plus récente de l'app est publiée
 * (endpoint /api/app-version/) et propose la mise à jour. Silencieux en cas
 * d'erreur réseau ou d'absence de version configurée → n'entrave jamais l'app.
 *
 * À monter une seule fois, haut dans l'arbre (App.tsx). Le Modal s'affiche
 * par-dessus toute l'interface.
 */
export default function UpdateGate() {
  const [info, setInfo] = React.useState<AppVersionInfo | null>(null);
  const [mandatory, setMandatory] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const latest = await appVersionApi.latest('android');
        if (cancelled || !latest?.latest_version) return;
        if (!isOutdated(APP_VERSION, latest.latest_version)) return;
        const forced =
          !!latest.min_supported_version &&
          compareVersions(APP_VERSION, latest.min_supported_version) < 0;
        setInfo(latest);
        setMandatory(forced);
      } catch {
        // vérification best-effort — on n'affiche rien en cas d'échec
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  return (
    <UpdateAvailableModal
      visible={!dismissed || mandatory}
      info={info}
      currentVersion={APP_VERSION}
      mandatory={mandatory}
      onDismiss={() => setDismissed(true)}
    />
  );
}
