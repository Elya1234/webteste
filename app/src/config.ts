/* Réglages de départ de la synagogue (les mêmes que l'écran TV, assets/ecran.html).
 * Au lancement, l'application les remplace par ceux de la base partagée (Google), modifiés depuis
 * l'administration de l'écran : l'appli et les télévisions affichent donc toujours la même chose. */
export type Prayer = { id: string; group: "weekday" | "friday" | "shabbat"; label: string; labelHe: string; times: string };
export type ZmanSetting = { id: string; method: string };
export type SynaConfig = {
  name: string; nameHe: string; geonameid: number; cityLabel: string; elevation: boolean;
  candleMinutes: number; havdalah: string; validatedByRav: boolean; showSeconds: boolean; showCountdown: boolean;
  footerLeft: string; footerRight: string; dedication: string; dedicationNames: string;
  prayers: Prayer[]; announcements: string[]; zmanim: ZmanSetting[]; useSchedule?: boolean;
};

export const DEFAULT_CONFIG: SynaConfig = {
  "name": "Beth Chalom",
  "nameHe": "בית שלום",
  "geonameid": 2988507,
  "cityLabel": "",
  "elevation": false,
  "candleMinutes": 18,
  "havdalah": "",
  "validatedByRav": false,
  "showSeconds": true,
  "showCountdown": true,
  "footerLeft": "Société Corpus Hovdjo",
  "footerRight": "hovadia26@gmail.com",
  "dedication": "לעלוי נשמת ציון בר סעדה לבית חורי ליזה בר חנינה דידו ואחיו משה בני ליזה לבית חורי",
  "dedicationNames": "רבי פראזי בר צלטנה לבית ביתאן ואשתו מזינה בת זוריא\nנורא בת חותה ומעתוק המכונה מותקי בר מזינה לבית ביתאן",
  "prayers": [
    {
      "id": "prayer_w1",
      "group": "weekday",
      "label": "Chaharit",
      "labelHe": "שחרית",
      "times": "07:00 / 08:00 / 08:45"
    },
    {
      "id": "prayer_w2",
      "group": "weekday",
      "label": "Minha-Arvit",
      "labelHe": "מנחה־ערבית",
      "times": "19:00"
    },
    {
      "id": "prayer_w3",
      "group": "weekday",
      "label": "Arvit",
      "labelHe": "ערבית",
      "times": "20:05"
    },
    {
      "id": "prayer_f1",
      "group": "friday",
      "label": "Minha",
      "labelHe": "מנחה",
      "times": "18:30"
    },
    {
      "id": "prayer_s1",
      "group": "shabbat",
      "label": "Chaharit",
      "labelHe": "שחרית",
      "times": "07:00 / 09:00 / 09:50"
    },
    {
      "id": "prayer_s2",
      "group": "shabbat",
      "label": "Minha",
      "labelHe": "מנחה",
      "times": "18:30"
    },
    {
      "id": "prayer_s3",
      "group": "shabbat",
      "label": "Arvit",
      "labelHe": "ערבית",
      "times": "19:58"
    }
  ],
  "announcements": [],
  "zmanim": [
    {
      "id": "alot",
      "method": "alot16.1"
    },
    {
      "id": "misheyakir",
      "method": "mish11.5"
    },
    {
      "id": "sunrise",
      "method": ""
    },
    {
      "id": "shemaMGA",
      "method": "mga16.1"
    },
    {
      "id": "shemaGRA",
      "method": "gra"
    },
    {
      "id": "tefilaMGA",
      "method": "mga16.1"
    },
    {
      "id": "tefilaGRA",
      "method": "gra"
    },
    {
      "id": "chatzot",
      "method": ""
    },
    {
      "id": "minchaG",
      "method": "gra"
    },
    {
      "id": "minchaK",
      "method": "gra"
    },
    {
      "id": "plag",
      "method": "gra"
    },
    {
      "id": "sunset",
      "method": ""
    },
    {
      "id": "tzeit",
      "method": "deg8.5"
    },
    {
      "id": "rt",
      "method": "rt72"
    },
    {
      "id": "chatzotNight",
      "method": ""
    }
  ]
};

export const REMOTE_URL: string = import.meta.env.VITE_REMOTE_URL ??
  "https://script.google.com/macros/s/AKfycbxfsUIHwUQCGC3oQvioq3IJFXLBZQHobTr0K2SOBB-LliZ7ZisnSNGuMlHQnEep_Lswdw/exec";
export const SCHEDULE_URL: string = import.meta.env.VITE_SCHEDULE_URL || "synagogue-horaires.json";
