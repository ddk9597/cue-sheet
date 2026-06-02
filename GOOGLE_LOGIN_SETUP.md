# Login Setup

The app supports both Google login and email code login.

## Google Login

Google account login needs one environment variable:

```env
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id
```

Create the client in Google Cloud Console:

1. Open Google Cloud Console.
2. Go to APIs & Services > Credentials.
3. Create Credentials > OAuth client ID.
4. Choose Application type: Web application.
5. Add Authorized JavaScript origins:
   - `http://localhost:3000`
   - your deployed site origin, for example `https://your-site.vercel.app`
6. Copy the client ID and set it as `GOOGLE_CLIENT_ID`.

For local development, add it to `.env.local`.

For Vercel deployment, add it in Project Settings > Environment Variables.

## Email Code Login

Email login sends a 6-digit code through SMTP. One SMTP sender can send to Gmail,
Naver, Daum, and other email addresses.

For Gmail SMTP, create a Google app password and set it only as an environment
variable. Do not commit the real password.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-google-app-password-without-spaces
SMTP_FROM=your-gmail-address@gmail.com
AUTH_CODE_SECRET=long-random-secret
```

For Vercel deployment, add these in Project Settings > Environment Variables.

Run locally:

```sh
npm run vercel:dev
```

Then open:

```text
http://localhost:3000
```
