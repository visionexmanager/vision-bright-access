import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "public", "audio", "reactions", "emoji");
const manifestPath = path.join(root, "src", "data", "reactionSoundManifest.ts");
const attributionPath = path.join(outputDir, "ATTRIBUTION.md");
const ffmpeg = process.env.FFMPEG_PATH;
const forceReimport = new Set(Array.from(process.env.FORCE_REIMPORT || ""));

if (!ffmpeg) {
  throw new Error("Set FFMPEG_PATH to an ffmpeg executable before running this script.");
}

// Each query describes a different real-world recording. Keep entries distinct:
// the importer also rejects reuse of the same Openverse source URL.
const catalog = [
  ["👍", "thumbs-up", "single affirmative yes voice"],
  ["❤️", "heart", "single human heartbeat stethoscope"],
  ["😂", "tears-of-joy", "loud belly laugh adult"],
  ["😮", "surprised", "short surprised human gasp"],
  ["👏", "clapping", "single person hand clapping"],
  ["😁", "grinning", "happy chuckle human"],
  ["😆", "squinting-laugh", "short burst laughter"],
  ["😅", "nervous-laugh", "nervous awkward laugh"],
  ["🤣", "rolling-laugh", "uncontrollable hysterical laughter"],
  ["😊", "warm-smile", "contented happy hum voice"],
  ["🥰", "affection", "gentle kiss sound human"],
  ["😍", "heart-eyes", "delighted sigh voice"],
  ["😎", "cool", "cool confident whistle"],
  ["🤩", "star-struck", "excited wow voice"],
  ["🥳", "party-face", "party horn short"],
  ["😜", "winking-tongue", "playful raspberry mouth"],
  ["🤪", "zany", "silly voice"],
  ["😝", "tongue-squint", "tongue raspberry"],
  ["🤔", "thinking", "thoughtful hmm voice"],
  ["🤨", "raised-eyebrow", "skeptical huh voice"],
  ["😏", "smirk", "subtle smug chuckle"],
  ["😒", "unamused", "annoyed sigh human"],
  ["🙄", "eye-roll", "dismissive scoff voice"],
  ["😤", "huffing", "angry nasal huff"],
  ["😡", "angry", "short angry growl human"],
  ["😢", "crying", "quiet human sob"],
  ["😭", "loud-crying", "loud crying wail human"],
  ["🥺", "pleading", "human whimper"],
  ["😳", "flushed", "embarrassed nervous gulp"],
  ["🫣", "peeking", "frightened whimper short"],
  ["🤯", "mind-blown", "shocked exclamation boom"],
  ["😇", "angelic", "soft choir ah short"],
  ["🥹", "holding-tears", "emotional sniffle"],
  ["😴", "sleeping", "gentle human snore"],
  ["🥱", "yawning", "human yawn close"],
  ["😬", "grimacing", "teeth chattering nervous"],
  ["🫠", "melting", "liquid drip"],
  ["🤐", "zip-mouth", "zipper close short"],
  ["😶", "no-mouth", "quiet breathing"],
  ["😐", "neutral", "monotone hmm voice"],
  ["🫡", "salute", "military salute boot click"],
  ["🤭", "hand-over-mouth", "muffled giggle"],
  ["🫢", "open-eyes-mouth", "sharp inhale gasp"],
  ["🤫", "shushing", "human shush voice"],
  ["😑", "expressionless", "bored exhale"],
  ["🙌", "raised-hands", "small crowd cheer hands up"],
  ["👋", "wave", "hand waving cloth whoosh"],
  ["🤝", "handshake", "hands slap"],
  ["✌️", "peace", "peaceful meditation bell short"],
  ["🤞", "crossed-fingers", "finger crossing rub"],
  ["🤙", "call-me", "telephone ring short"],
  ["👍🏼", "thumbs-up-medium", "spoken okay voice"],
  ["👎", "thumbs-down", "single person boo voice"],
  ["💪", "strong", "weightlifter effort grunt"],
  ["🙏", "prayer", "single temple prayer bell"],
  ["🫶", "heart-hands", "two soft hand pats"],
  ["🫂", "hug", "clothing hug rustle"],
  ["💃", "woman-dancing", "flamenco heel tap"],
  ["🕺", "man-dancing", "male dance shoe step"],
  ["🤜", "right-fist", "punch impact light"],
  ["🤛", "left-fist", "fist bump contact"],
  ["🙋", "raising-hand", "student says me voice"],
  ["🤦", "facepalm", "hand slap forehead"],
  ["🤷", "shrug", "confused huh voice"],
  ["🔥", "fire", "small fire crackle close"],
  ["💯", "hundred", "perfect score game voice"],
  ["⭐", "star", "single bright glockenspiel note"],
  ["🌟", "glowing-star", "sparkling magic chime"],
  ["✨", "sparkles", "tiny sparkle shimmer"],
  ["💫", "dizzy-star", "spinning twinkle sound"],
  ["🎉", "party-popper", "confetti pop short"],
  ["🎊", "confetti-ball", "celebration pop"],
  ["🎈", "balloon", "balloon inflate squeak"],
  ["🎁", "gift", "wrapping paper"],
  ["💥", "collision", "short impact explosion"],
  ["🚀", "rocket", "rocket launch ignition short"],
  ["💎", "gem", "crystal glass ping"],
  ["🏆", "trophy", "victory fanfare very short"],
  ["🥇", "gold-medal", "medal ceremony sting"],
  ["🎯", "bullseye", "dart hits target"],
  ["💡", "light-bulb", "light switch click electric"],
  ["❄️", "snowflake", "ice crack delicate"],
  ["🌈", "rainbow", "harp glissando short"],
  ["🌊", "wave", "single ocean wave crash"],
  ["⚡", "lightning", "lightning thunder crack"],
  ["🌙", "moon", "night crickets short"],
  ["☀️", "sun", "morning birds short"],
  ["🍀", "clover", "grass rustle close"],
  ["🦋", "butterfly", "butterfly wing flutter close"],
  ["🌸", "cherry-blossom", "flower petal soft rustle"],
  ["🌺", "hibiscus", "tropical breeze short"],
  ["🌻", "sunflower", "bee buzzing flower short"],
  ["🎵", "music-note", "single piano note"],
  ["🎶", "music-notes", "three piano notes melody"],
  ["🎮", "game-controller", "arcade game start beep"],
  ["⚽", "soccer", "soccer ball kick"],
  ["🏀", "basketball", "basketball bounce single"],
  ["🎸", "guitar", "electric guitar chord short"],
  ["🍕", "pizza", "crispy pizza bite"],
  ["🍔", "burger", "large food bite crunch"],
  ["🧁", "cupcake", "cake bite soft"],
  ["🍭", "lollipop", "candy wrapper crinkle"],
  ["🐶", "dog", "single dog bark close"],
  ["😺", "cat", "domestic cat meow single"],
  ["🦄", "unicorn", "horse neigh short"],
  ["🐧", "penguin", "penguin call"],
  ["🦊", "fox", "red fox bark call"],
  ["🐸", "frog", "single frog croak"],
  ["👻", "ghost", "human spooky ghost moan"],
  ["💀", "skull", "dry bones rattle"],
  ["🤖", "robot", "robot voice beep phrase"],
  ["👽", "alien", "alien voice effect"],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}: ${stderr.slice(-1000)}`));
    });
  });
}

async function searchOpenverse(query, usedUrls) {
  const ignored = new Set([
    "single", "short", "small", "tiny", "soft", "gentle", "loud", "close",
    "real", "realistic", "human", "adult", "very", "quiet", "quick", "light",
  ]);
  const meaningful = query.split(/\s+/).filter((word) => !ignored.has(word.toLowerCase()));
  const variants = [...new Set([
    query,
    meaningful.join(" "),
    meaningful.slice(-3).join(" "),
    meaningful.slice(-2).join(" "),
    meaningful.slice(0, 3).join(" "),
    ...meaningful.slice().reverse(),
  ].filter(Boolean))];
  const candidates = new Map();

  for (const variant of variants) {
    const params = new URLSearchParams({
      q: variant,
      page_size: "20",
      mature: "false",
    });
    let response;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        response = await fetch(`https://api.openverse.org/v1/audio/?${params}`, {
          headers: { "User-Agent": "Visionex reaction sound importer/1.0" },
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        response = null;
      }
      if (!response) {
        await sleep(750 * (attempt + 1));
        continue;
      }
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) break;
      await sleep(750 * (attempt + 1));
    }
    if (!response) continue;
    if (!response.ok) throw new Error(`Openverse search failed: ${response.status}`);
    const data = await response.json();
    const results = data.results
      .filter((item) => item.url && item.filetype === "mp3" && !usedUrls.has(item.url))
      .filter((item) => ["cc0", "by", "by-sa"].includes(item.license));
    for (const item of results) candidates.set(item.url, item);
    await sleep(100);
  }

  const queryWords = meaningful.map((word) => word.toLowerCase());
  const scored = [...candidates.values()].map((item) => {
    const haystack = [
      item.title,
      ...(item.tags || []).map((tag) => tag.name),
    ].join(" ").toLowerCase();
    const matches = queryWords.filter((word) => haystack.includes(word)).length;
    const duration = Number(item.duration || Number.MAX_SAFE_INTEGER);
    const durationBonus = duration <= 3000 ? 2 : duration <= 10000 ? 1 : 0;
    const licenseBonus = item.license === "cc0" ? 0.5 : item.license === "by" ? 0.25 : 0;
    return { item, score: matches * 4 + durationBonus + licenseBonus };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.item ?? null;
}

async function download(url, target) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 Visionex/1.0" },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`Audio download failed: ${response.status} ${url}`);
      await writeFile(target, Buffer.from(await response.arrayBuffer()));
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(750 * (attempt + 1));
    }
  }
}

async function processAudio(input, output) {
  await run(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-i", input,
    "-af",
    "silenceremove=start_periods=1:start_duration=0.03:start_threshold=-48dB,atrim=0:2.9,afade=t=out:st=2.72:d=0.18,loudnorm=I=-18:TP=-2:LRA=7",
    "-ar", "44100",
    "-ac", "1",
    "-b:a", "96k",
    output,
  ]);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });

  const cacheDir = path.join(root, ".cache");
  const cachePath = path.join(cacheDir, "reaction-sounds.json");
  await mkdir(cacheDir, { recursive: true });
  let cache = {};
  try { cache = JSON.parse(await readFile(cachePath, "utf8")); } catch { /* first run */ }

  const usedUrls = new Set();
  const manifest = {};
  const credits = [];

  for (let index = 0; index < catalog.length; index += 1) {
    const [emoji, slug, query] = catalog[index];
    const cached = forceReimport.has(emoji) ? null : cache[emoji];
    let source = cached?.source;
    const outputName = `${String(index + 1).padStart(3, "0")}-${slug}.mp3`;
    const output = path.join(outputDir, outputName);

    if (!source || usedUrls.has(source.url)) {
      source = await searchOpenverse(query, usedUrls);
      await sleep(140);
    }
    if (!source) throw new Error(`No unique openly licensed audio found for ${emoji} (${query})`);

    usedUrls.add(source.url);
    let outputExists = false;
    try { await access(output); outputExists = true; } catch { /* generate it */ }
    if (!outputExists) {
      const tempName = `${createHash("sha1").update(source.url).digest("hex")}.mp3`;
      const temp = path.join(outputDir, tempName);
      try {
        await download(source.url, temp);
      } catch {
        usedUrls.add(source.url);
        delete cache[emoji];
        source = await searchOpenverse(query, usedUrls);
        if (!source) throw new Error(`No downloadable alternative found for ${emoji} (${query})`);
        usedUrls.add(source.url);
        await download(source.url, temp);
      }
      await processAudio(temp, output);
      await rm(temp, { force: true });
    }

    cache[emoji] = { source };
    await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
    manifest[emoji] = `/audio/reactions/emoji/${outputName}`;
    credits.push({
      emoji,
      file: outputName,
      title: source.title,
      creator: source.creator || "Unknown",
      landingUrl: source.foreign_landing_url,
      license: `${source.license.toUpperCase()} ${source.license_version || ""}`.trim(),
      licenseUrl: source.license_url,
      attribution: source.attribution,
    });
    console.log(`[${index + 1}/${catalog.length}] ${emoji} -> ${source.title}`);
  }

  const manifestSource = `// Generated by scripts/import-reaction-sounds.mjs.\n` +
    `// Every reaction maps to a distinct local recording no longer than 3 seconds.\n` +
    `export const REACTION_SOUND_MANIFEST: Readonly<Record<string, string>> = ${JSON.stringify(manifest, null, 2)};\n`;
  await writeFile(manifestPath, manifestSource, "utf8");

  const attribution = [
    "# Voice Room Reaction Audio Attribution",
    "",
    "Files were discovered through the Openverse API. Each file is trimmed,",
    "mono-converted, faded, and loudness-normalized for use as a reaction sound.",
    "",
    ...credits.flatMap((credit) => [
      `## ${credit.emoji} - ${credit.file}`,
      "",
      `- Work: [${credit.title}](${credit.landingUrl})`,
      `- Creator: ${credit.creator}`,
      `- License: [${credit.license}](${credit.licenseUrl})`,
      `- Attribution: ${credit.attribution}`,
      "",
    ]),
  ].join("\n");
  await writeFile(attributionPath, attribution, "utf8");
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

await main();
