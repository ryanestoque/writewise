"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PenToolIcon,
  SearchIcon,
  XCircleIcon,
  LayersIcon,
  RotateCcwIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  BookOpenIcon,
  FilterIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    coachingTip: "Crucial Grade 3 join: The lowercase 'b' bridge must connect directly to the next letter from the midline without dipping to the baseline.",
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

interface CursiveGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CursiveGuideDialog({ open, onOpenChange }: CursiveGuideDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [caseFilter, setCaseFilter] = useState<"pairs" | "upper" | "lower">("pairs");
  const [zoneFilter, setZoneFilter] = useState<"all" | "ascender" | "midline" | "descender" | "highJoiner">("all");
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>("A");
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Global hotkey '/' inside modal to focus search
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Filtered letters computation
  const filteredLetters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CURSIVE_ALPHABET.filter((item) => {
      // Zone filter
      if (zoneFilter === "ascender" && item.zone !== "ascender") return false;
      if (zoneFilter === "midline" && item.zone !== "midline") return false;
      if (zoneFilter === "descender" && item.zone !== "descender") return false;
      if (zoneFilter === "highJoiner" && !item.isHighJoiner) return false;

      // Search query
      if (!q) return true;
      return (
        item.id.toLowerCase() === q ||
        item.name.toLowerCase().includes(q) ||
        item.zoneLabel.toLowerCase().includes(q) ||
        item.strokeSummary.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q)) ||
        item.practiceWords.some((w) => w.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, zoneFilter]);

  // Active selected letter object
  const activeLetter = useMemo(() => {
    if (!selectedLetterId) return filteredLetters[0] ?? CURSIVE_ALPHABET[0];
    return CURSIVE_ALPHABET.find((l) => l.id === selectedLetterId) ?? filteredLetters[0] ?? CURSIVE_ALPHABET[0];
  }, [selectedLetterId, filteredLetters]);

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    
    const index = filteredLetters.findIndex((l) => l.id === activeLetter.id);
    if (index === -1) return;
    
    let columns = 2; // mobile default
    if (typeof window !== "undefined") {
      if (window.matchMedia("(min-width: 1024px)").matches) columns = 4;
      else if (window.matchMedia("(min-width: 640px)").matches) columns = 3;
    }

    let nextIndex = index;
    if (e.key === "ArrowRight") nextIndex = index + 1;
    else if (e.key === "ArrowLeft") nextIndex = index - 1;
    else if (e.key === "ArrowDown") nextIndex = index + columns;
    else if (e.key === "ArrowUp") nextIndex = index - columns;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = filteredLetters.length - 1;
    
    nextIndex = Math.max(0, Math.min(nextIndex, filteredLetters.length - 1));
    
    const targetLetter = filteredLetters[nextIndex];
    if (targetLetter) {
      setSelectedLetterId(targetLetter.id);
      const targetBtn = gridRef.current?.querySelector(`button[data-letter-id="${targetLetter.id}"]`) as HTMLButtonElement | null;
      targetBtn?.focus();
    }
  };

  const renderSpotlightContent = (isMobileSheet = false) => {
    if (!activeLetter) return null;
    return (
      <section
        aria-label={`Detailed formation guide for Letter ${activeLetter.id}`}
        className={cn(
          "rounded-2xl border border-primary/25 bg-linear-to-b from-card via-card to-primary/5 shadow-xs space-y-4 p-4 sm:p-5",
          isMobileSheet && "border-none shadow-none bg-transparent p-0"
        )}
      >
        {/* Spotlight Header: Navigation + Title */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-xl bg-primary text-primary-foreground font-heading font-bold text-lg flex items-center justify-center shadow-xs">
              {activeLetter.id}
            </span>
            <div>
              <h4 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
                <span>{activeLetter.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  ({activeLetter.zoneLabel} Letter{activeLetter.isHighJoiner ? " • High Joiner" : ""})
                </span>
              </h4>
              <p className="text-xs text-muted-foreground">
                Elementary Standard ~{activeLetter.slantDegree}° Forward Slant • 2:1 Proportions
              </p>
            </div>
          </div>
        </div>

        {/* Large Visual Stroke Display on 3-Line Penmanship Ruling */}
        <div className="w-full h-32 sm:h-36 rounded-xl border border-border/70 bg-background/90 dark:bg-surface/80 relative overflow-hidden flex items-center justify-center shadow-2xs">
          <svg
            viewBox="0 0 400 100"
            preserveAspectRatio="none"
            role="img"
            className="w-full h-full select-none"
            aria-label={`Detailed cursive stroke diagram for ${activeLetter.id}`}
          >
            <g aria-hidden="true">
              {/* Ruling Lines */}
              {/* Headline at y=25 */}
              <line x1="10" y1="25" x2="390" y2="25" stroke="currentColor" className="text-slate-400 dark:text-slate-500" strokeWidth="1" strokeOpacity="0.7" />
              <text x="14" y="21" fontSize="9" className="fill-slate-500 dark:fill-slate-400 font-sans font-medium">Headline</text>

              {/* Midline at y=50 */}
              <line x1="10" y1="50" x2="390" y2="50" stroke="currentColor" className="text-teal-600 dark:text-teal-400" strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.8" />
              <text x="14" y="46" fontSize="9" className="fill-teal-600 dark:fill-teal-400 font-sans font-medium">Dotted Midline (x-Height)</text>

              {/* Baseline at y=75 */}
              <line x1="10" y1="75" x2="390" y2="75" stroke="currentColor" className="text-orange-600 dark:text-orange-400" strokeWidth="1.8" strokeOpacity="0.9" />
              <text x="14" y="71" fontSize="9" className="fill-orange-600 dark:fill-orange-400 font-sans font-bold">Solid Baseline</text>

              {/* Descender Line at y=90 */}
              <line x1="10" y1="90" x2="390" y2="90" stroke="currentColor" className="text-slate-300 dark:text-slate-600" strokeWidth="0.8" strokeDasharray="2 2" strokeOpacity="0.5" />
              <text x="14" y="96" fontSize="8" className="fill-slate-400 font-sans">Descender Zone</text>

              {/* ~68° Slant Guideline */}
              <line x1="170" y1="85" x2="210" y2="15" stroke="currentColor" className="text-primary" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.35" />
              <text x="212" y="20" fontSize="8" className="fill-primary font-sans font-semibold">~68° Slant</text>

              {/* Big Cursive Letters on Baseline */}
              <text
                x="50%"
                y="75"
                dominantBaseline="alphabetic"
                textAnchor="middle"
                className="font-cursive fill-foreground"
                style={{ fontSize: "56px", fontWeight: 500 }}
              >
                {activeLetter.upper}{activeLetter.lower}
              </text>
            </g>
          </svg>
        </div>

        {/* Stroke Formation Steps (Uppercase & Lowercase) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Uppercase Steps */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">
                {activeLetter.upper}
              </span>
              <span>Capital Letter Formation ({activeLetter.upper})</span>
            </div>
            <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
              {activeLetter.upperSteps.map((step, idx) => (
                <li key={idx} className="pl-1">
                  <span className="text-foreground/90">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Lowercase Steps */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <span className="size-5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[11px] font-bold">
                {activeLetter.lower}
              </span>
              <span>Lowercase Letter Formation ({activeLetter.lower})</span>
            </div>
            <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
              {activeLetter.lowerSteps.map((step, idx) => (
                <li key={idx} className="pl-1">
                  <span className="text-foreground/90">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Coaching Tip & Common Pitfall */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-teal-500/20 bg-teal-500/5 dark:bg-teal-500/10 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300">
              <CheckCircle2Icon className="size-3.5 shrink-0" />
              <span>Pedagogical Coaching Tip</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {activeLetter.coachingTip}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangleIcon className="size-3.5 shrink-0" />
              <span>Watch Out: Common Pitfall</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {activeLetter.commonPitfall}
            </p>
          </div>
        </div>

        {/* Practice Vocabulary Words */}
        <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-muted-foreground flex items-center gap-1">
            <BookOpenIcon className="size-3.5 text-primary" aria-hidden="true" />
            Grade 3 Practice Words:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeLetter.practiceWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/80 bg-muted/40 font-medium text-foreground"
              >
                <span className="font-cursive text-sm text-primary">{word}</span>
                <span className="text-[10px] text-muted-foreground font-sans">({word})</span>
              </span>
            ))}
          </div>
        </div>
      </section>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="cursive-guide-dialog"
        overlayClassName="bg-foreground/25 supports-backdrop-filter:backdrop-blur-xs"
        className="p-0 overflow-hidden flex flex-col gap-0 shadow-warm w-[calc(100%-1rem)] sm:max-w-4xl max-h-[min(92dvh,calc(100vh-1.5rem))] rounded-2xl print:max-w-none print:w-full print:max-h-none print:shadow-none print:rounded-none print:border-none print:p-0"
      >
        {/* Streamlined Header: Title + Print + Search */}
        <DialogHeader className="p-3.5 sm:p-5 pb-3 sm:pb-3.5 border-b border-border/70 bg-background/95 backdrop-blur-xs shrink-0 space-y-3 print:hidden">
          <div className="flex items-center justify-between gap-3 min-w-0 pr-10 sm:pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="size-8 sm:size-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs"
                aria-hidden="true"
              >
                <PenToolIcon className="size-4 sm:size-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-heading font-semibold text-foreground tracking-tight truncate">
                    Cursive Alphabet Guide
                  </DialogTitle>
                </div>
                <p className="text-xs text-muted-foreground truncate hidden sm:block">
                  Authentic 3-line elementary penmanship ruling, stroke formations, and joining standards.
                </p>
              </div>
            </div>
          </div>

          <DialogDescription className="sr-only">
            Interactive cursive handwriting guide showing uppercase and lowercase letter formations on 3-line ruling with stroke cues.
          </DialogDescription>

          {/* Search & Case / Zone Filters Bar */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              {/* Quick Search */}
              <div role="search" aria-label="Search cursive letters" className="relative flex-1 min-w-0">
                <label htmlFor="cursive-search-input" className="sr-only">
                  Filter cursive alphabet by letter or keyword
                </label>
                <SearchIcon
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/70 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="cursive-search-input"
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search letters (e.g., 'G', 'loop')... (Press '/')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && searchQuery) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClearSearch();
                    }
                  }}
                  className="w-full h-10 sm:h-9 pl-8 pr-8 text-xs rounded-lg border border-border/80 bg-background placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all [&::-webkit-search-cancel-button]:hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-10 sm:size-7 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label="Clear search"
                  >
                    <XCircleIcon className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile Filters Toggle */}
              <button
                type="button"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className={cn(
                  "sm:hidden flex items-center justify-center size-10 rounded-lg border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer",
                  isFiltersOpen 
                    ? "bg-primary/10 border-primary/30 text-primary" 
                    : "border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                aria-label="Toggle filters"
                aria-expanded={isFiltersOpen}
              >
                <FilterIcon className="size-4.5" />
              </button>
            </div>

            {/* Case Mode Selector & Zone Filters */}
            <div className={cn(
              "flex-col sm:flex-row items-stretch sm:items-center gap-2.5",
              isFiltersOpen ? "flex animate-in fade-in slide-in-from-top-1" : "hidden sm:flex"
            )}>
              {/* Case Mode Selector (Pairs, Upper, Lower) */}
              <div
                role="radiogroup"
                aria-label="Filter letter case"
                className="inline-flex items-center p-0.5 rounded-lg border border-border/70 bg-muted/40 shrink-0 self-start sm:self-auto"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={caseFilter === "pairs"}
                  onClick={() => setCaseFilter("pairs")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                    caseFilter === "pairs"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Pairs (Aa)
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={caseFilter === "upper"}
                  onClick={() => setCaseFilter("upper")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                    caseFilter === "upper"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Upper (A–Z)
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={caseFilter === "lower"}
                  onClick={() => setCaseFilter("lower")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                    caseFilter === "lower"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Lower (a–z)
                </button>
              </div>

              {/* Zone Filter Chips */}
              <div
                role="toolbar"
                aria-label="Filter by letter category"
                className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs"
              >
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <LayersIcon className="size-3" aria-hidden="true" />
                  Category:
                </span>

                {[
                  { id: "all", label: "All Letters", count: 26 },
                  { id: "ascender", label: "Ascenders (Tall)", count: 7 },
                  { id: "midline", label: "Midline (Short)", count: 14 },
                  { id: "descender", label: "Descenders (Tail)", count: 6 },
                  { id: "highJoiner", label: "High Joiners", count: 4 },
                ].map((chip) => {
                  const isActive = zoneFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setZoneFilter(chip.id as typeof zoneFilter)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-colors cursor-pointer border",
                        isActive
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-background/80 text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      {chip.label}
                      <span className="ml-1 text-[10px] opacity-80 tabular-nums">({chip.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {filteredLetters.length === 26
              ? "Showing all 26 cursive letters"
              : `Showing ${filteredLetters.length} letters matching filter`}
          </div>
        </DialogHeader>

        {/* Split Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Grid View */}
          <div className="flex-1 overflow-y-auto overscroll-contain focus-visible:outline-none p-3.5 sm:p-5 space-y-5 md:border-r border-border/70">
            {/* 3-Line Penmanship Ruling Key (Educational Legend) */}
            <section
              aria-label="3-Line Penmanship Geometry Legend"
              className="p-3 sm:p-3.5 rounded-xl border border-border/70 bg-muted/20 dark:bg-card/40 space-y-2.5 print:hidden"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden="true" />
                    <strong>Headline:</strong> Tall Ascenders & Capitals
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-teal-600 dark:bg-teal-400" aria-hidden="true" />
                    <strong>Midline:</strong> Dotted x-Height (Short letters)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-orange-600 dark:bg-orange-400" aria-hidden="true" />
                    <strong>Baseline:</strong> Solid Base Guide
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-indigo-500" aria-hidden="true" />
                    <strong>Descender:</strong> Tail Loops below baseline
                  </span>
                </div>
              </div>
            </section>

            {/* Letter Cards Grid */}
            <section aria-labelledby="alphabet-grid-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3
                  id="alphabet-grid-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground print:text-black"
                >
                  Cursive Letterforms ({filteredLetters.length})
                </h3>
                <span className="text-xs text-muted-foreground print:hidden">
                  Click any letter card to inspect formation cues
                </span>
              </div>

              {filteredLetters.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-3">
                  <p className="text-xs font-medium text-foreground">No letters match your search criteria</p>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcwIcon className="size-3" aria-hidden="true" />
                    Reset filters
                  </button>
                </div>
              ) : (
                <div
                  ref={gridRef}
                  onKeyDown={handleGridKeyDown}
                  role="list"
                  aria-label="Cursive alphabet grid"
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 print:grid-cols-4 print:gap-3"
                >
                  {filteredLetters.map((item) => {
                    const isSelected = activeLetter.id === item.id;
                    const letterDisplayText =
                      caseFilter === "pairs"
                        ? `${item.upper}${item.lower}`
                        : caseFilter === "upper"
                        ? item.upper
                        : item.lower;

                    return (
                      <div key={item.id} role="listitem" className="min-w-0 print:break-inside-avoid">
                        <button
                          type="button"
                          data-letter-id={item.id}
                          tabIndex={isSelected ? 0 : -1}
                          onClick={() => {
                            setSelectedLetterId(item.id);
                            setIsMobileDetailOpen(true);
                          }}
                          aria-pressed={isSelected}
                          aria-label={`Letter ${item.id}. Click to view detailed formation guide.`}
                          className={cn(
                            "w-full relative group flex flex-col text-left rounded-xl border transition-all duration-150 overflow-hidden cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            "h-20 sm:h-24 print:h-20 print:border-black print:bg-white",
                            isSelected
                              ? "border-primary ring-2 ring-primary/40 bg-card shadow-sm dark:bg-card/90"
                              : "border-border/70 bg-card/60 hover:bg-card hover:border-border hover:shadow-2xs dark:bg-card/40"
                          )}
                        >
                          <div className="relative z-10 flex items-center justify-between px-3 pt-2 pb-0.5 min-w-0">
                            <span className="font-sans font-bold text-xs text-foreground/80 tracking-tight">
                              {item.id}{item.lower}
                            </span>
                          </div>
                          <div className="relative flex-1 w-full min-h-0 overflow-hidden flex items-center justify-center">
                            <span
                              className="font-cursive text-foreground print:text-black leading-none"
                              style={{
                                fontSize: caseFilter === "pairs" ? "36px" : "42px",
                                fontWeight: 500,
                              }}
                            >
                              {letterDisplayText}
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right: Spotlight View (Desktop) */}
          <div className="hidden md:block w-[420px] lg:w-[480px] shrink-0 bg-muted/20 overflow-y-auto p-4 sm:p-5">
            {renderSpotlightContent(false)}
          </div>
        </div>
      </DialogContent>

      {/* Mobile Drawer / Sheet View */}
      {isMobileDetailOpen && (
        <Sheet open={isMobileDetailOpen} onOpenChange={setIsMobileDetailOpen}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-4 overflow-y-auto sm:hidden">
            <SheetHeader className="p-0 pb-3 border-b border-border/70 flex flex-row items-center justify-between">
              <SheetTitle className="text-base font-heading font-semibold">
                Letter {activeLetter?.id} Detail Guide
              </SheetTitle>
            </SheetHeader>
            <div className="pt-4 pb-6">
              {renderSpotlightContent(true)}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Dialog>
  );
}

