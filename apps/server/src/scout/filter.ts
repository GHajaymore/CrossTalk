// The Scout always drops tragedies and crime, health scares, and private people's lives
// (docs/PLAN.md, step 2). Checked on every source item before ranking, and again on what the model returns.
const NO_GO = [
  // tragedies and crime
  /\b(kill(ed|s|ing)?|dead|deaths?|died|dies|murder\w*|shoot(ing|er|ings)?|shot dead|stabb\w*|massacre|terror\w*|bomb(ing|ed)?|explosion|hostage\w*)\b/i,
  /\b(crash(es|ed)?|wreck|derail\w*|collapse[ds]?|earthquake|flood(s|ing)? kill|wildfire kill|disaster|tragedy|tragic|victims?|funeral|mourn\w*)\b/i,
  /\b(rape[ds]?|sexual assault|abuse[ds]?|assault(ed)?|kidnap\w*|traffick\w*|arrest(ed|s)?|charged with|convicted|sentenced|manslaughter|homicide|suicide)\b/i,
  // health scares
  /\b(outbreak|pandemic|epidemic|virus|infection|cancer|overdose|contamina\w*|recall(ed)? over|deadly)\b/i,
  // private lives
  /\b(divorce|affair|pregnan\w*|obituary|leaked (photos|nudes)|doxx\w*)\b/i,
];

export const isNoGo = (text: string) => NO_GO.some(r => r.test(text));
