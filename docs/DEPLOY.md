# Put CrossTalk online at crosstalk.ajailabs.app (free, on Render)

CrossTalk runs as one small server that also serves the app. Render's free plan hosts it, and your
domain points at it. Nothing here costs money. Set aside about 15 minutes, plus DNS waiting time.

## What "free" means here

- **It sleeps.** After 15 minutes with nobody using it, Render pauses it. The next visit takes about
  a minute to wake it up.
- **It forgets.** Saved episodes, Iris's sketches and her notes are wiped when the server restarts
  or redeploys. That's fine for trying it on your phone. Keeping episodes needs a host with a disk
  (for example a Google Cloud always-free VM), which can come later.
- **Rendered recordings aren't uploaded.** Episodes play with your phone's own voices there.

## The lock

While it runs in mock mode (sample text, no key), CrossTalk is open: anyone with the link can look,
and there's nothing to spend or leak. As soon as you switch to real models (`PROVIDER_MODE=openrouter`),
it asks for your `ACCESS_CODE` and refuses to start without one: you type it once on each device, and
that device stays signed in for 30 days. After 5 wrong tries from one address it waits 10 minutes.
Pick a code of at least 8 characters that you don't use anywhere else, for example three random words.

## Steps

1. **Merge this branch into `main`** on GitHub. Render deploys `main`.
2. Go to **render.com** and sign up with **GitHub**. No card is needed for the free plan.
3. Click **New → Blueprint**. Pick the **CrossTalk** repository and click **Apply**. Render reads
   `render.yaml` and creates a web service called `crosstalk` on the free plan.
4. It asks for **ACCESS_CODE**. Type your code there, in Render's page only. Never put it in chat,
   in a file or in the repo.
5. Wait for the first deploy to say **Live**. Open the `crosstalk-….onrender.com` link it shows,
   type your code, and check the app opens in **Mock## Point crosstalk.ajailabs.app at it

ajailabs.app is the Ajai Labs parent site, so CrossTalk lives on a subdomain. Only one record is
added; the existing `@` and `www` records stay as they are.

6. In Render, open the **crosstalk** service, then **Settings → Custom Domains → Add Custom
   Domain**, and enter `crosstalk.ajailabs.app`.
7. In GoDaddy: **My Products → ajailabs.app → DNS → Add New Record**:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `crosstalk` | your service's address, e.g. `crosstalk-ij27.onrender.com` |

8. Back in Render, click **Verify**. DNS usually takes minutes, sometimes an hour. Render then
   issues the HTTPS certificate automatically. `.app` domains only work over HTTPS, so wait for
   the green certificate tick before opening it.
9. Open **https://crosstalk.ajailabs.app** on your phone, type the code, then use **Share → Add
   to Home Screen** (iPhone) or **⋮ → Install app** (Android). It opens full screen like an app.

 an app.

## Real models later (still free)

In Render, open **Environment** and add these, one by one. The key goes only into Render's page:

- `PROVIDER_MODE` = `openrouter`
- `OPENROUTER_API_KEY` = your key
- `SPEAKER_A_MODEL`, `SPEAKER_B_MODEL`, `ARTIST_MODEL` = three different free model IDs (see
  docs/MODELS.md)

Save, and Render redeploys. The free-model guard still blocks anything that isn't $0, and the
app's limit of 40 requests a day still applies.
