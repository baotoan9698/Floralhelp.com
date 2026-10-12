#!/bin/bash
# Install as /usr/local/sbin/floralhelp-deploy, owned by root, mode 700.
set -Eeuo pipefail
exec 9>/run/lock/floralhelp-deploy.lock
flock -n 9 || exit 0
export GIT_SSH_COMMAND='ssh -i /etc/floralhelp/github_deploy -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/etc/floralhelp/github_known_hosts'
repo=/srv/floralhelp/repository.git
git --git-dir="$repo" fetch --quiet origin refs/heads/main:refs/heads/main
revision=$(git --git-dir="$repo" rev-parse refs/heads/main)
[[ "$revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$(cat /etc/floralhelp/deployed-revision 2>/dev/null || true)" != "$revision" ]] || exit 0
[[ "$(cat /etc/floralhelp/failed-revision 2>/dev/null || true)" != "$revision" ]] || exit 0
trap 'echo "$revision" > /etc/floralhelp/failed-revision; echo "DEPLOY_FAILED $revision; inspect journalctl -u floralhelp-deploy" >&2' ERR
echo "DEPLOY_START $revision"
release="/srv/floralhelp/releases/$revision"
install -d -o floralhelp -g floralhelp "$release"
git --git-dir="$repo" archive "$revision" | tar -x -C "$release"
chown -R floralhelp:floralhelp "$release"
ln -sfn /srv/floralhelp/shared/private-storage "$release/.private-storage"
set -a
source /etc/floralhelp/app.env
set +a
cd "$release"
runuser -u floralhelp -- npm ci --no-audit --no-fund
runuser -u floralhelp -- env NODE_OPTIONS=--max-old-space-size=1536 npm run build
# Back up before applying database changes; never reset the database.
/usr/local/sbin/floralhelp-backup
runuser -u floralhelp -- npm run db:migrate
previous=$(readlink -f /srv/floralhelp/current)
ln -sfn "$release" /srv/floralhelp/current.next
mv -Tf /srv/floralhelp/current.next /srv/floralhelp/current
systemctl restart floralhelp
healthy=0
for attempt in $(seq 1 20); do
  if curl --silent --fail -H 'Host: sale.floralhelp.com' http://127.0.0.1:3000/login >/dev/null; then healthy=1; break; fi
  sleep 2
done
if [[ "$healthy" != 1 ]]; then
  ln -sfn "$previous" /srv/floralhelp/current.next
  mv -Tf /srv/floralhelp/current.next /srv/floralhelp/current
  systemctl restart floralhelp
  echo 'Previous code restored. Database migrations are not automatically reversed.' >&2
  false
fi
echo "$revision" > /etc/floralhelp/deployed-revision
rm -f /etc/floralhelp/failed-revision
echo "DEPLOY_OK $revision"
# Keep current and previous code; only prune SHA-named release directories.
for candidate in /srv/floralhelp/releases/*; do
  [[ -d "$candidate" && ! -L "$candidate" ]] || continue
  [[ "$(basename "$candidate")" =~ ^[0-9a-f]{40}$ ]] || continue
  [[ "$candidate" != "$release" && "$candidate" != "$previous" ]] || continue
  rm -rf -- "$candidate"
done
