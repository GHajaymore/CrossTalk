# Put CrossTalk online at crosstalk.ajailabs.app (free, on Render)

CrossTalk runs as one small server that also serves the app. Render's free plan hosts it, and your
domain points at it. Nothing here costs money. Set aside about 15 minutes, plus DNS waiting time.

## What "free" means here

- **It sleeps.** After 15 minutes with nobody using it, Render pauses it. The next visit takes about
  a minute to wake it up.
- **It forgets, unless you add the free backup.** Render wipes its disk when the server restarts,
  sleeps or redeploys. Add a free Backblaze bucket (see **Keep episodes for good** below) and
  episodes, Iris's sketches, her notes and your settings come back by themselves.
- **Rendered recordings aren't uploaded.** Episodes play with your phone's own voices there.

## The lock

While it runs in mock mode (sample text, no key), CrossTalk is open: anyone with the link can look,
and there's nothing to spend or leak. As soon as you switch to real models (`PROVIDER_MODE=openrouter`),
it asks for your `ACCESS_CODE` and refuses to start without one: you type it once on each device, and
that device stays signed in for 30 days. After 5 wrong tries from one address it waits 10 minutes.
Pick a code of at least 8 characters that you don't use anywhere else, for example three random words.

## The Control room's own lock

Online, the **Control room** (rules, producer notes, publishing, topics) is always locked, even in
mock mode, so visitors can look around but can't change anything. To use it online, add an
`ADMIN_CODE` in Render: your crosstalk service → **Environment** → **Add Environment Variable** →
`ADMIN_CODE` = any 8+ characters you'll remember → **Save Changes**. Type it once in the Control room
on each device. If you set `ACCESS_CODE` too, that also opens the Control room. On your own computer it
is always open.

## Steps

1. **Merge this branch into `main`** on GitHub. Render deploys `main`.
2. Go to **render.com** and sign up with **GitHub**. No card is needed for the free plan.
3. Click **New → Blueprint**. Pick the **CrossTalk** repository and click **Apply**. Render reads
   `render.yaml` and creates a web service called `crosstalk` on the free plan.
4. It asks for **ACCESS_CODE**. Type your code there, in Render's page only. Never put it in chat,
   in a file or in the repo.
5. Wait for the first deploy to say **Live**. Open the `crosstalk-….onrender.com` link it shows,
   type your code, and check the app opens in **Mock mode**.

## Point crosstalk.ajailabs.app at it

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

## Keep episodes for good (free, about 10 minutes)

CrossTalk keeps everything in one database: episodes, transcripts, **Iris's sketches**, her
listener notes, the Scout's topics and the Control room's rules. With a backup set up, a small free
tool (Litestream) copies every change to your own private cloud bucket within about 10 seconds.
When Render wakes or redeploys the app, it copies everything back before it opens.

**1. Make a free Backblaze B2 bucket** (10 GB free)

1. Sign up at **backblaze.com → B2 Cloud Storage**.
2. **Buckets → Create a Bucket.** Pick any unique name (for example `crosstalk-yourname`). Keep
   **Files in Bucket** set to **Private**. Leave encryption and object lock off.
3. On the new bucket's card, copy the **Endpoint**, for example `s3.us-west-004.backblazeb2.com`.
   The middle part (`us-west-004`) is your **region**.
4. **Application Keys → Add a New Application Key.** Name it `crosstalk`, allow access to **only
   that bucket**, type **Read and Write**. Copy the **keyID** and **applicationKey** straight into
   step 2. Backblaze shows the applicationKey only once.

**2. Tell Render** (Environment page, then **Save, rebuild, and deploy**)

| Key | Value |
|---|---|
| `BACKUP_BUCKET` | your bucket name |
| `BACKUP_ENDPOINT` | `https://` + the endpoint, e.g. `https://s3.us-west-004.backblazeb2.com` |
| `BACKUP_REGION` | the region, e.g. `us-west-004` |
| `BACKUP_KEY_ID` | the keyID |
| `BACKUP_SECRET` | the applicationKey |

Paste the keys only into Render's page, never into a chat, a file or this repo.

**3. Check it.** Make an episode and wait until Iris has drawn it. Then, in Render, use **Manual
Deploy → Restart service**. When the app comes back, the episode and its sketch are still there.
In Render's **Logs** you'll see `restoring snapshot` at start-up and `wal segment written` as you
make episodes.

**Settings → Backup** asks the bucket itself and shows when its newest copy landed, or what
Litestream says is wrong (it re-checks every 30 minutes; **Check backup now** asks at once). It also
says whether this start brought episodes back or found the bucket empty. If copies aren't arriving,
a warning shows on Create and Episodes too.

Good to know:

- If one of the five settings is missing, the app starts without a backup and says so in the logs.
- If the bucket can't be reached at start-up, the app doesn't start empty (an empty start could
  overwrite your backup). Render tries again, and the log says why.
- Litestream keeps 7 days of history. Even busy use stays far inside the free 10 GB.
- Rendered recordings (`tools/voice`) are files, not database rows, so they aren't backed up. Online,
  episodes play with the phone's own voices anyway.

## Real models later (still free)

In Render, open **Environment** and add these, one by one. The key goes only into Render's page:

- `PROVIDER_MODE` = `openrouter`
- `OPENROUTER_API_KEY` = your key
- `SPEAKER_A_MODEL`, `SPEAKER_B_MODEL`, `ARTIST_MODEL` = three different free model IDs (see
  docs/MODELS.md)

Save, and Render redeploys. The free-model guard still blocks anything that isn't $0, and the
app's limit of 40 requests a day still applies.

**Running out of requests?** OpenRouter's free models stop at 50 a day per account. Two ways up,
both free:
- Raise `MAX_REQUESTS_PER_DAY` to `48`. That's the most OpenRouter allows without buying credits.
- Switch to Groq (much higher free limits, counted per model): set `PROVIDER_MODE` = `groq`,
  `GROQ_API_KEY`, `GROQ_PLAN` = `free` (only if your Groq account has no card) and three Groq model
  IDs, then raise `MAX_REQUESTS_PER_DAY` (e.g. `300`). docs/MODELS.md has the steps.

## Host photos

The hosts' photo-real faces are made by Pollinations, a free image service with no key or account.
Each face is made once, saved with your episodes and reused, so only a few are ever requested. To
keep everything on your server and use the drawn portraits instead, add `PORTRAITS` = `off` in
Render's **Environment** tab.

Iris's full paintings come from the same free service. To keep her to line art, add `IRIS_PICTURES` = `off`.
