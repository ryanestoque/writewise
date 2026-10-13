export type LetterZone = "ascender" | "midline" | "descender";

export interface LetterGuideItem {
  id: string; // "A", "B", ...
  upper: string;
  lower: string;
  name: string;
  zone: LetterZone;
  zoneLabel: "Ascender" | "Midline" | "Descender";
  isHighJoiner?: boolean;
  bothExtremes?: boolean;
  slantDegree: number; // default ~68°
  strokeSummary: string;
  upperSteps: string[];
  lowerSteps: string[];
  coachingTip: string;
  commonPitfall: string;
  practiceWords: string[];
  keywords: string[];
}

export const CURSIVE_ALPHABET: LetterGuideItem[] = [
  {
    id: "A",
    upper: "A",
    lower: "a",
    name: "Letter Aa",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Smooth oval counter with crisp baseline tie-off and exit swash.",
    upperSteps: [
      "Begin near baseline; slant upward forward to touch headline.",
      "Sweep down to baseline on left side forming wide oval body.",
      "Climb back up to top, pull straight down to baseline, and tie off with small horizontal exit loop."
    ],
    lowerSteps: [
      "Begin at baseline; sweep slantingly up to dotted midline.",
      "Curve back down left to baseline, closing complete oval counter.",
      "Pull down straight along right side to baseline with sharp upward exit curve."
    ],
    coachingTip: "Ensure the lowercase 'a' oval is fully closed before pulling down the right stem, otherwise it resembles 'u' or 'ci'.",
    commonPitfall: "Leaving the top oval counter open or failing to touch the dotted midline.",
    practiceWords: ["apple", "ant", "animal", "around"],
    keywords: ["a", "apple", "vowel", "midline", "oval", "counter"],
  },
  {
    id: "B",
    upper: "B",
    lower: "b",
    name: "Letter Bb",
    zone: "ascender",
    zoneLabel: "Ascender",
    isHighJoiner: true,
    slantDegree: 68,
    strokeSummary: "Tall ascender loop to headline with high horizontal bridge join at midline.",
    upperSteps: [
      "Slanted downstroke from headline to baseline with small entry hook.",
      "Retrace up to form upper lobe touching headline and midline.",
      "Form lower lobe resting flat on baseline, tucked with inner loop."
    ],
    lowerSteps: [
      "Upward continuous sweep from baseline reaching headline.",
      "Loop backward and pull straight down along slant to baseline.",
      "Climb back to dotted midline, form small right-hand loop, and finish with a high horizontal bridge."
    ],
    coachingTip: "Crucial join: The lowercase 'b' bridge must connect directly to the next letter from the midline without dipping to the baseline.",
    commonPitfall: "Dropping the exit bridge down to the baseline, which erroneously turns 'b' into an 'l' or 'lo'.",
    practiceWords: ["ball", "bird", "blue", "book"],
    keywords: ["b", "ball", "ascender", "tall", "loop", "bridge", "high joiner"],
  },
  {
    id: "C",
    upper: "C",
    lower: "c",
    name: "Letter Cc",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Graceful open crescent resting on baseline with fluid forward tilt.",
    upperSteps: [
      "Entry loop just below headline.",
      "Sweep gracefully along headline, curve around down to baseline.",
      "Finish with upward sweeping exit swash."
    ],
    lowerSteps: [
      "Sweep up slantingly from baseline to touch dotted midline.",
      "Retrace back along curve, form open rounded bowl resting on baseline.",
      "Sweep forward with smooth exit stroke to join subsequent letter."
    ],
    coachingTip: "Keep the back curve rounded and slanted forward; avoid sharp corners or flattening.",
    commonPitfall: "Leaning backwards or making the mouth of the letter too narrow.",
    practiceWords: ["cat", "cup", "clean", "color"],
    keywords: ["c", "cat", "midline", "short", "crescent", "curve"],
  },
  {
    id: "D",
    upper: "D",
    lower: "d",
    name: "Letter Dd",
    zone: "ascender",
    zoneLabel: "Ascender",
    slantDegree: 68,
    strokeSummary: "Rounded oval counter with tall straight ascender stem reaching headline.",
    upperSteps: [
      "Straight downstroke from headline to baseline.",
      "Form small baseline knot at bottom, then sweep wide right-hand arc to headline.",
      "Tuck inward at headline with decorative loop."
    ],
    lowerSteps: [
      "Form standard oval counter starting from baseline up to dotted midline.",
      "Climb tall and straight up to headline along the forward slant angle.",
      "Retrace down the same vertical stem to baseline, finishing with an exit curve."
    ],
    coachingTip: "Retrace down the stem neatly; do not let the ascender loop open up into an accidental 'l'.",
    commonPitfall: "Separating the oval body from the ascender stem, creating a print-like gap.",
    practiceWords: ["dog", "door", "drum", "dance"],
    keywords: ["d", "dog", "ascender", "tall", "stem", "headline"],
  },
  {
    id: "E",
    upper: "E",
    lower: "e",
    name: "Letter Ee",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Compact looped letter filling the zone between baseline and dotted midline.",
    upperSteps: [
      "Upper curved bowl starting at headline and looping at dotted midline.",
      "Lower larger bowl curving from midline down to baseline.",
      "Smooth exit swash along baseline."
    ],
    lowerSteps: [
      "Slanted upward entry from baseline halfway to dotted midline.",
      "Loop gently leftward touching dotted midline.",
      "Cross over down to baseline, finishing with upward forward exit curve."
    ],
    coachingTip: "Keep the eye of the lowercase 'e' open and clearly visible so it does not collapse into a closed line.",
    commonPitfall: "Pinching the loop shut so it resembles 'i' without a dot.",
    practiceWords: ["egg", "eagle", "earth", "every"],
    keywords: ["e", "egg", "vowel", "midline", "loop", "eye"],
  },
  {
    id: "F",
    upper: "F",
    lower: "f",
    name: "Letter Ff",
    zone: "ascender",
    zoneLabel: "Ascender",
    bothExtremes: true,
    slantDegree: 68,
    strokeSummary: "Unique dual-zone letter: upper loop to headline and lower loop into descender space.",
    upperSteps: [
      "Wavy decorative horizontal cap at headline.",
      "Slanted stem down to baseline with left bottom hook.",
      "Neat horizontal crossbar across the dotted midline."
    ],
    lowerSteps: [
      "Long upward sweep from baseline touching headline.",
      "Loop back and pull straight down through baseline into descender space.",
      "Loop forward to right, climb back up to baseline, and tie off with small knot/bridge."
    ],
    coachingTip: "The knot of lowercase 'f' must close exactly on the baseline before joining the next letter.",
    commonPitfall: "Floating the lower descender loop above the baseline or cutting the top loop too short.",
    practiceWords: ["fish", "flag", "frog", "family"],
    keywords: ["f", "fish", "ascender", "descender", "two-way", "headline", "tail"],
  },
  {
    id: "G",
    upper: "G",
    lower: "g",
    name: "Letter Gg",
    zone: "descender",
    zoneLabel: "Descender",
    slantDegree: 68,
    strokeSummary: "Midline oval body with fluid forward-crossing descender tail loop.",
    upperSteps: [
      "Sweeping entry stroke from baseline to headline.",
      "Sharp peak loop at headline, curving down into midline lobe.",
      "Pull down below baseline into descender tail loop crossing at baseline."
    ],
    lowerSteps: [
      "Standard oval counter between baseline and dotted midline.",
      "Pull down straight along slant through baseline into descender zone.",
      "Loop forward to left, crossing neatly right at the baseline line into exit stroke."
    ],
    coachingTip: "The intersection of the lower loop must occur precisely at the baseline to avoid messy letter joins.",
    commonPitfall: "Crossing the tail too low or making the tail loop excessively bulbous.",
    practiceWords: ["girl", "green", "game", "grass"],
    keywords: ["g", "girl", "descender", "tail", "loop", "baseline"],
  },
  {
    id: "H",
    upper: "H",
    lower: "h",
    name: "Letter Hh",
    zone: "ascender",
    zoneLabel: "Ascender",
    slantDegree: 68,
    strokeSummary: "Tall ascender loop to headline paired with smooth midline arch down to baseline.",
    upperSteps: [
      "Left slanted stem with headline entry curve.",
      "Right vertical stem from headline to baseline.",
      "Connecting loop at dotted midline binding both stems together."
    ],
    lowerSteps: [
      "Ascender loop starting at baseline, climbing to headline, pulling down to baseline.",
      "Retrace up stem into smooth rounded arch touching dotted midline.",
      "Curve down to baseline with forward exit curve."
    ],
    coachingTip: "The arch must hit the dotted midline with a rounded peak, matching the rhythm of 'm' and 'n'.",
    commonPitfall: "Separating the ascender loop and arch, making it look like 'l' and 'r'.",
    practiceWords: ["hat", "house", "hand", "happy"],
    keywords: ["h", "hat", "ascender", "tall", "arch", "headline"],
  },
  {
    id: "I",
    upper: "I",
    lower: "i",
    name: "Letter Ii",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Simple midline slant with straight downstroke and neat singular dot.",
    upperSteps: [
      "Horizontal sweep along baseline, rising smoothly to headline.",
      "Curving downstroke down to baseline with open crescent bottom."
    ],
    lowerSteps: [
      "Slanted upward stroke from baseline to dotted midline.",
      "Retrace down along same slant to baseline with sharp exit curve.",
      "Place single crisp dot directly above stem, just over the dotted midline."
    ],
    coachingTip: "Lift pencil only to dot the 'i' after completing the entire continuous cursive word.",
    commonPitfall: "Drawing a circle, heart, or dash instead of a clean dot, or dotting too high.",
    practiceWords: ["ink", "ice", "igloo", "island"],
    keywords: ["i", "ink", "vowel", "midline", "short", "dot"],
  },
  {
    id: "J",
    upper: "J",
    lower: "j",
    name: "Letter Jj",
    zone: "descender",
    zoneLabel: "Descender",
    slantDegree: 68,
    strokeSummary: "Straight stem plunging through baseline into slender forward tail loop.",
    upperSteps: [
      "Start below baseline, sweep upward through midline to headline.",
      "Plunge straight down below baseline, looping forward to cross at baseline."
    ],
    lowerSteps: [
      "Slanted entry from baseline to dotted midline.",
      "Pull straight down through baseline into descender space.",
      "Forward loop crossing at baseline, finished with single dot above midline."
    ],
    coachingTip: "Keep the lower tail slender and parallel to the slant of 'g' and 'y'.",
    commonPitfall: "Forgetting to place the dot or making the lower loop backwards.",
    practiceWords: ["jar", "jump", "jeep", "jungle"],
    keywords: ["j", "jar", "descender", "tail", "dot", "loop"],
  },
  {
    id: "K",
    upper: "K",
    lower: "k",
    name: "Letter Kk",
    zone: "ascender",
    zoneLabel: "Ascender",
    slantDegree: 68,
    strokeSummary: "Tall ascender loop with centered midline tuck and angled baseline kick.",
    upperSteps: [
      "Left vertical stem with top entry loop.",
      "Upper diagonal arm from headline into center stem at midline.",
      "Lower diagonal leg from midline to baseline with exit curve."
    ],
    lowerSteps: [
      "Tall ascender loop reaching headline, pulling down to baseline.",
      "Retrace up to dotted midline, form small enclosed eye loop.",
      "Kick out diagonally down to baseline with smooth exit stroke."
    ],
    coachingTip: "Keep the tuck loop small and anchored right beneath the dotted midline.",
    commonPitfall: "Making the center knot too large or failing to retrace neatly along the stem.",
    practiceWords: ["kite", "king", "key", "kitten"],
    keywords: ["k", "kite", "ascender", "tall", "tuck", "kick"],
  },
  {
    id: "L",
    upper: "L",
    lower: "l",
    name: "Letter Ll",
    zone: "ascender",
    zoneLabel: "Ascender",
    slantDegree: 68,
    strokeSummary: "Graceful sweeping loop reaching headline with wide forward tilt.",
    upperSteps: [
      "Top loop at headline, pulling down along forward slant to baseline.",
      "Small bottom knot resting flat on baseline, swept out with horizontal wave."
    ],
    lowerSteps: [
      "Smooth upward climb from baseline all the way to top headline.",
      "Loop gently leftward and pull straight down along slant to baseline.",
      "Curve forward smoothly along baseline into exit stroke."
    ],
    coachingTip: "Letter 'l' must reach the top headline to clearly differentiate it from 'e'.",
    commonPitfall: "Stunting the ascender height so it looks like an oversized 'e'.",
    practiceWords: ["lion", "leaf", "lake", "light"],
    keywords: ["l", "lion", "ascender", "tall", "loop", "headline"],
  },
  {
    id: "M",
    upper: "M",
    lower: "m",
    name: "Letter Mm",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Three uniform downward hills with rounded crests touching dotted midline.",
    upperSteps: [
      "Starting entry curve at headline.",
      "Three graceful downward stems from headline to baseline with rounded tops.",
      "Finish with upward baseline exit swash."
    ],
    lowerSteps: [
      "Entry curve from baseline to dotted midline, down to baseline.",
      "Retrace up to midline for second hill, down to baseline.",
      "Retrace up to midline for third hill, down to baseline with upward exit curve."
    ],
    coachingTip: "Count three full humps. All three humps must touch the dotted midline with equal width.",
    commonPitfall: "Drawing only two humps (which becomes 'n') or making sharp pointed peaks like 'w'.",
    practiceWords: ["moon", "milk", "map", "mother"],
    keywords: ["m", "moon", "midline", "short", "hills", "humps"],
  },
  {
    id: "N",
    upper: "N",
    lower: "n",
    name: "Letter Nn",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Two uniform downward hills with rounded crests touching dotted midline.",
    upperSteps: [
      "Starting loop at headline, drop to baseline.",
      "Climb back to headline, pull second stem down to baseline with exit curve."
    ],
    lowerSteps: [
      "Entry curve from baseline to dotted midline, drop to baseline.",
      "Retrace up to midline for second hill, drop to baseline with exit curve."
    ],
    coachingTip: "Ensure the peaks are softly rounded at the midline, maintaining equal spacing.",
    commonPitfall: "Adding an extra hump, causing it to be misread as 'm'.",
    practiceWords: ["nest", "nut", "net", "name"],
    keywords: ["n", "nest", "midline", "short", "hills", "humps"],
  },
  {
    id: "O",
    upper: "O",
    lower: "o",
    name: "Letter Oo",
    zone: "midline",
    zoneLabel: "Midline",
    isHighJoiner: true,
    slantDegree: 68,
    strokeSummary: "Complete oval counter with high horizontal bridge connecting at midline.",
    upperSteps: [
      "Sweeping oval starting at headline, descending to baseline.",
      "Climb back up to headline, finishing with inner loop."
    ],
    lowerSteps: [
      "Slanted entry from baseline to dotted midline.",
      "Curve counter-clockwise to baseline, closing full oval at dotted midline.",
      "Finish with horizontal exit bridge across midline to link to subsequent letter."
    ],
    coachingTip: "Letter 'o' connects from the top (midline). Do not drop the stroke down to the baseline to join.",
    commonPitfall: "Connecting from the bottom of the oval, which erroneously turns 'o' into 'a'.",
    practiceWords: ["owl", "open", "orange", "ocean"],
    keywords: ["o", "owl", "vowel", "midline", "oval", "high joiner", "bridge"],
  },
  {
    id: "P",
    upper: "P",
    lower: "p",
    name: "Letter Pp",
    zone: "descender",
    zoneLabel: "Descender",
    slantDegree: 68,
    strokeSummary: "Straight stem plunging below baseline, retraced into rounded midline lobe.",
    upperSteps: [
      "Straight stem from headline to baseline with entry hook.",
      "Upper rounded bowl from headline down to dotted midline."
    ],
    lowerSteps: [
      "Slant up from baseline to dotted midline.",
      "Pull straight down along slant into descender space below baseline.",
      "Retrace back up stem to baseline and form rounded lobe up to midline, closing at baseline with exit curve."
    ],
    coachingTip: "Retrace up the vertical stem neatly; the lobe must touch both midline and baseline.",
    commonPitfall: "Leaving the lobe open or not descending deep enough below the baseline.",
    practiceWords: ["pen", "pig", "plant", "paper"],
    keywords: ["p", "pen", "descender", "tail", "stem", "lobe"],
  },
  {
    id: "Q",
    upper: "Q",
    lower: "q",
    name: "Letter Qq",
    zone: "descender",
    zoneLabel: "Descender",
    slantDegree: 68,
    strokeSummary: "Midline oval body with backward-looping descender tail hooking to baseline.",
    upperSteps: [
      "Full oval loop like capital 'O'.",
      "Graceful loop swash resting flat across baseline."
    ],
    lowerSteps: [
      "Standard oval counter between baseline and dotted midline.",
      "Pull straight down along slant into descender zone.",
      "Loop backward (to the right), climb to baseline, and finish with forward exit hook."
    ],
    coachingTip: "Unlike 'g' which loops left/forward, 'q' loops backward/rightward before connecting.",
    commonPitfall: "Looping to the left, which completely transforms 'q' into 'g'.",
    practiceWords: ["queen", "quiet", "quick", "quilt"],
    keywords: ["q", "queen", "descender", "tail", "backward loop", "oval"],
  },
  {
    id: "R",
    upper: "R",
    lower: "r",
    name: "Letter Rr",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Distinctive midline shoulder step with horizontal slide and curved exit.",
    upperSteps: [
      "Vertical stem from headline to baseline.",
      "Upper bowl to midline, then slanted leg down to baseline with exit curve."
    ],
    lowerSteps: [
      "Slant upward from baseline to dotted midline.",
      "Make a tiny step slightly above midline, horizontal flat shoulder slide.",
      "Curve down to baseline with smooth upward exit curve."
    ],
    coachingTip: "The horizontal shoulder at the dotted midline is the hallmark of clear cursive 'r'.",
    commonPitfall: "Omitting the shoulder step so the letter looks like a single slanted spike or 'i'.",
    practiceWords: ["rose", "rain", "river", "rabbit"],
    keywords: ["r", "rose", "midline", "short", "shoulder", "step"],
  },
  {
    id: "S",
    upper: "S",
    lower: "s",
    name: "Letter Ss",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Slanted sweep to midline with rounded belly retracing along baseline.",
    upperSteps: [
      "Slanted entry from baseline to headline with top loop.",
      "Swelling rounded belly down to baseline with inner tie-off loop."
    ],
    lowerSteps: [
      "Slant upward from baseline to dotted midline with gentle peak.",
      "Curve inward forming rounded belly down to baseline.",
      "Retrace back along baseline and exit smoothly to join next letter."
    ],
    coachingTip: "Curve the belly well before retracing along the baseline.",
    commonPitfall: "Making the belly too flat or failing to retrace on the baseline before joining.",
    practiceWords: ["sun", "star", "ship", "smile"],
    keywords: ["s", "sun", "midline", "short", "belly", "retrace"],
  },
  {
    id: "T",
    upper: "T",
    lower: "t",
    name: "Letter Tt",
    zone: "ascender",
    zoneLabel: "Ascender",
    slantDegree: 68,
    strokeSummary: "Tall straight ascender stem reaching nearly to headline, crossed neatly at midline.",
    upperSteps: [
      "Wavy horizontal cap at headline.",
      "Slanted stem down to baseline with left bottom curl."
    ],
    lowerSteps: [
      "Start at baseline, climb straight up along slant nearly to headline.",
      "Retrace down along same line to baseline with upward exit curve.",
      "Cross neatly with horizontal stroke right along the dotted midline."
    ],
    coachingTip: "Cross the 't' right on the dotted midline; lift pencil to cross only after finishing the word.",
    commonPitfall: "Making a loop in the stem (which turns it into 'l') or crossing too high.",
    practiceWords: ["tree", "tiger", "train", "table"],
    keywords: ["t", "tree", "ascender", "tall", "stem", "crossbar", "midline"],
  },
  {
    id: "U",
    upper: "U",
    lower: "u",
    name: "Letter Uu",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Rounded valley resting on baseline, filling the zone to dotted midline.",
    upperSteps: [
      "Entry hook at headline, drop to baseline.",
      "Rounded bowl rising to headline, down to baseline with exit curve."
    ],
    lowerSteps: [
      "Slant to dotted midline, curve down into rounded valley on baseline.",
      "Climb back up to dotted midline, pull down straight to baseline with exit curve."
    ],
    coachingTip: "The base of 'u' must be a rounded cup, unlike 'v' which has a sharper corner and high join.",
    commonPitfall: "Making pointed bottoms or forgetting the right downward stem.",
    practiceWords: ["under", "uncle", "umbrella", "uniform"],
    keywords: ["u", "umbrella", "vowel", "midline", "valley", "cup"],
  },
  {
    id: "V",
    upper: "V",
    lower: "v",
    name: "Letter Vv",
    zone: "midline",
    zoneLabel: "Midline",
    isHighJoiner: true,
    slantDegree: 68,
    strokeSummary: "Midline dip with high horizontal exit bridge connecting at dotted midline.",
    upperSteps: [
      "Entry loop at headline, drop to baseline.",
      "Climb back to headline, finishing with small horizontal top bridge."
    ],
    lowerSteps: [
      "Entry curve to dotted midline, smooth dip down to baseline.",
      "Climb up to dotted midline with a small horizontal bridge to join next letter."
    ],
    coachingTip: "High joiner: Connects from the dotted midline. Do not drop to the baseline.",
    commonPitfall: "Dropping the exit stroke to the baseline, which transforms 'v' into 'u'.",
    practiceWords: ["van", "vine", "vase", "voice"],
    keywords: ["v", "van", "midline", "short", "bridge", "high joiner"],
  },
  {
    id: "W",
    upper: "W",
    lower: "w",
    name: "Letter Ww",
    zone: "midline",
    zoneLabel: "Midline",
    isHighJoiner: true,
    slantDegree: 68,
    strokeSummary: "Double rounded baseline valleys finishing with high horizontal bridge at midline.",
    upperSteps: [
      "Entry loop at headline, double valley dipping to baseline.",
      "Finishing with top loop at headline."
    ],
    lowerSteps: [
      "Double valley from dotted midline to baseline with uniform width.",
      "End with high horizontal connecting bridge across dotted midline."
    ],
    coachingTip: "Keep both valleys equal in depth and width; exit high across the midline.",
    commonPitfall: "Uneven valley sizes or dropping the exit stroke down to the baseline.",
    practiceWords: ["water", "wind", "wood", "whale"],
    keywords: ["w", "water", "midline", "short", "double valley", "high joiner"],
  },
  {
    id: "X",
    upper: "X",
    lower: "x",
    name: "Letter Xx",
    zone: "midline",
    zoneLabel: "Midline",
    slantDegree: 68,
    strokeSummary: "Curved stroke from midline to baseline crossed by opposite diagonal line.",
    upperSteps: [
      "Compound curve from headline to baseline, crossed by diagonal stroke."
    ],
    lowerSteps: [
      "Curved stroke from dotted midline to baseline with exit curve.",
      "Cross with opposite diagonal stroke intersecting in the center of the x-height zone."
    ],
    coachingTip: "Cross right at the center between dotted midline and baseline.",
    commonPitfall: "Crossing too high or making both strokes completely straight like print 'x'.",
    practiceWords: ["box", "fox", "six", "xylophone"],
    keywords: ["x", "box", "midline", "cross", "diagonal"],
  },
  {
    id: "Y",
    upper: "Y",
    lower: "y",
    name: "Letter Yy",
    zone: "descender",
    zoneLabel: "Descender",
    slantDegree: 68,
    strokeSummary: "Midline cup with straight stem plunging below baseline into forward tail loop.",
    upperSteps: [
      "Valley from headline to baseline and back to headline.",
      "Straight stem down below baseline with forward tail loop crossing at baseline."
    ],
    lowerSteps: [
      "Entry curve and rounded cup between dotted midline and baseline.",
      "Pull down straight along slant through baseline into descender space.",
      "Loop forward to left, crossing neatly right at baseline into exit stroke."
    ],
    coachingTip: "Ensure the cup reaches the dotted midline before pulling down into the tail.",
    commonPitfall: "Shallow descender tail or crossing the loop above the baseline.",
    practiceWords: ["yellow", "yarn", "yard", "yogurt"],
    keywords: ["y", "yellow", "descender", "tail", "loop", "cup"],
  },
  {
    id: "Z",
    upper: "Z",
    lower: "z",
    name: "Letter Zz",
    zone: "descender",
    zoneLabel: "Descender",
    slantDegree: 68,
    strokeSummary: "Midline wave with baseline notch and fluid descender tail loop.",
    upperSteps: [
      "Wave along headline, diagonal to baseline, lower cursive loop below baseline."
    ],
    lowerSteps: [
      "Curved shoulder along dotted midline, small notch sitting on baseline.",
      "Loop down into descender space below baseline, swinging forward across baseline."
    ],
    coachingTip: "The small notch must rest cleanly on the baseline before plunging into the tail loop.",
    commonPitfall: "Omitting the baseline notch, which makes 'z' look like a cursive '3' or 'g'.",
    practiceWords: ["zebra", "zoo", "zero", "zigzag"],
    keywords: ["z", "zebra", "descender", "tail", "notch", "shoulder"],
  },
];
