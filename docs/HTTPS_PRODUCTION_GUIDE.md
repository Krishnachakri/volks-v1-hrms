# VOLKS HRMS - HTTPS, TLS & Production Cookie Configuration

> Classification: DOCUMENTED (not yet certified as deployed)  
> This document provides the required guidance for production TLS configuration.

---

## Why TLS Is Required

VOLKS uses `HttpOnly; SameSite=Lax` session cookies. The `Secure` flag must be added
in production so that cookies are only transmitted over HTTPS connections.

Without HTTPS:
- Cookies are sent over plain HTTP and can be intercepted on the network
- The `Secure` attribute is ignored in development (HTTP) but must be set in production
- Modern browsers may warn users about insecure cookies

---

## Adding the Secure Flag

The server currently sets:
```
Set-Cookie: volks_session=<token>; Path=/; HttpOnly; SameSite=Lax
```

For production, this must become:
```
Set-Cookie: volks_session=<token>; Path=/; HttpOnly; SameSite=Lax; Secure
```

To enable this, set `NODE_ENV=production` in your environment. The server will conditionally
add the `Secure` flag when not in development mode.

Update `server.ts` login handler:
```typescript
const isProduction = process.env.NODE_ENV === 'production';
const cookieFlags = `Path=/; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`;
res.setHeader('Set-Cookie', `volks_session=${sessionToken}; ${cookieFlags}`);
```

---

## TLS Termination Architecture

VOLKS Node.js server itself does not terminate TLS directly.
TLS should be terminated by a reverse proxy in front of the Node.js process.

### Recommended Architecture

```
Internet
    |
    | HTTPS (443)
    v
[nginx / Caddy]          <-- TLS termination here
    |
    | HTTP (internal)
    v
[VOLKS Node.js API]      <-- port 4000
    |
    v
[PostgreSQL]             <-- port 5432 (internal network only)
```

---

## Nginx Configuration Example

```nginx
server {
    listen 443 ssl http2;
    server_name hrms.yourcompany.com;

    ssl_certificate     /etc/ssl/certs/hrms.crt;
    ssl_certificate_key /etc/ssl/private/hrms.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    # Frontend (React/Vite build)
    location / {
        root /var/www/volks-hrms/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://localhost:4000;
    }

    location /ready {
        proxy_pass http://localhost:4000;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name hrms.yourcompany.com;
    return 301 https://$host$request_uri;
}
```

---

## Caddy Configuration Example (Automatic TLS)

```
hrms.yourcompany.com {
    root * /var/www/volks-hrms/dist
    file_server

    handle /api/* {
        reverse_proxy localhost:4000
    }

    handle /health {
        reverse_proxy localhost:4000
    }

    handle /ready {
        reverse_proxy localhost:4000
    }
}
```

Caddy automatically provisions and renews Let's Encrypt certificates.

---

## Trusted Proxy Configuration

When behind nginx/Caddy, the client IP seen by Node.js is the proxy's IP, not the real client.
To correctly apply the login rate limiter, set:

```env
TRUSTED_PROXY=true
```

This instructs the rate limiter to read the client IP from the `X-Forwarded-For` header.

CAUTION: Only set `TRUSTED_PROXY=true` if your proxy:
1. Strips any client-supplied `X-Forwarded-For` headers before adding its own
2. Is the only network path into the Node.js server

If the Node.js port (4000) is accessible directly from the internet while `TRUSTED_PROXY=true`,
an attacker can forge their IP via X-Forwarded-For to bypass rate limits.

---

## Production Environment Checklist

Before deploying to production:

- [ ] TLS certificate installed and auto-renewing
- [ ] `NODE_ENV=production` set in environment
- [ ] `Secure` cookie flag active (verify in browser DevTools > Application > Cookies)
- [ ] `CORS_ALLOWED_ORIGINS` set to exact production frontend domain (no wildcards, no trailing slash)
- [ ] `TRUSTED_PROXY=true` if behind nginx/Caddy
- [ ] PostgreSQL port (5432) not exposed to the internet
- [ ] Node.js port (4000) not exposed to the internet (only through reverse proxy)
- [ ] Strong `DATABASE_URL` password set
- [ ] UAT seed accounts NOT seeded in production (`NODE_ENV=production` prevents auto-seed)
- [ ] Firewall rules reviewed
- [ ] Automated certificate renewal tested

---

## Note on UAT vs Production Cookie Behaviour

During UAT (HTTP localhost), cookies work without the `Secure` flag because:
- Browsers treat `localhost` as a secure context
- Development mode omits `Secure` deliberately

When moving to production HTTPS, the `Secure` flag will be active.
Testers should verify cookie persistence works correctly in the HTTPS production environment
as part of any pre-go-live smoke test.