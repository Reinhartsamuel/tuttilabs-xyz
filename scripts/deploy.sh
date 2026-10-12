#!/usr/bin/env bash
#
# Build the static site, publish it to the nginx web root, install the vhost,
# and (when DNS allows) issue TLS with certbot.
#
# Safe to re-run: the build is deterministic, rsync mirrors, and certbot is only
# invoked when there is no certificate yet and both names resolve to this host.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="/var/www/tuttilabs"
NGINX_SITE="/etc/nginx/sites-available/tuttilabs.xyz"
NGINX_ENABLED="/etc/nginx/sites-enabled/tuttilabs.xyz"
SITE_DOMAIN="tuttilabs.xyz"
WWW_DOMAIN="www.tuttilabs.xyz"
LETSENCRYPT_EMAIL="smuel.rr@gmail.com"

cd "$REPO_DIR"

echo "==> build"
npm run build

echo "==> publish to ${WEB_ROOT}"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "${REPO_DIR}/dist/" "${WEB_ROOT}/"
sudo chown -R www-data:www-data "$WEB_ROOT"

echo "==> install nginx vhost"
sudo install -m 644 "${REPO_DIR}/deploy/nginx/tuttilabs.xyz" "$NGINX_SITE"
sudo ln -sfn "$NGINX_SITE" "$NGINX_ENABLED"
sudo nginx -t
sudo systemctl reload nginx
echo "    nginx reloaded; existing vhosts (cuantum, winr, default) untouched"

resolves_to() {
  local host="$1" want="$2" got
  got="$(getent ahostsv4 "$host" 2>/dev/null | awk 'NR==1 {print $1}')"
  [ -n "$got" ] && [ "$got" = "$want" ]
}

public_ip="$(curl -4 -s --max-time 8 https://ifconfig.me || true)"

if [ -d "/etc/letsencrypt/live/${SITE_DOMAIN}" ]; then
  echo "==> TLS already issued for ${SITE_DOMAIN}; nothing to do"
  exit 0
fi

if [ -n "$public_ip" ] && resolves_to "$SITE_DOMAIN" "$public_ip" && resolves_to "$WWW_DOMAIN" "$public_ip"; then
  echo "==> issuing TLS for ${SITE_DOMAIN} and ${WWW_DOMAIN}"
  sudo certbot --nginx -d "$SITE_DOMAIN" -d "$WWW_DOMAIN" \
    --agree-tos -m "$LETSENCRYPT_EMAIL" --redirect --non-interactive
  echo "==> done: https://${SITE_DOMAIN}"
  exit 0
fi

cat <<EOF

==> TLS skipped: DNS is not pointing here yet.

Add these records in the Cloudflare dashboard for tuttilabs.xyz (zone: tuttilabs.xyz),
with the proxy status set to "DNS only" (grey cloud) for the first certificate
issuance. HTTP-01 validation cannot pass through the Cloudflare proxy:

  A     tuttilabs.xyz        ${public_ip:-<this VPS IPv4>}     TTL auto
  A     www.tuttilabs.xyz    ${public_ip:-<this VPS IPv4>}     TTL auto

Optional, if you want IPv6 served from this VPS too:

  AAAA  tuttilabs.xyz        2a02:4780:41:cb3b::1             TTL auto
  AAAA  www.tuttilabs.xyz    2a02:4780:41:cb3b::1             TTL auto

Then run the TLS step (or re-run this script):

  cd ${REPO_DIR} && bash scripts/deploy.sh

Once the certificate exists you can switch the proxy back to "Proxied" (orange
cloud) if you want Cloudflare in front; set the SSL mode to Full (strict).

Site is already being served on this host; verify without DNS with:

  curl -sS -H 'Host: tuttilabs.xyz' http://127.0.0.1/ | head -5

EOF
