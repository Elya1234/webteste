/* Noms français des parties du Siddour (Sefaria ne les donne qu'en anglais et en hébreu) et rangement en rubriques. */
export const FR: Record<string, string> = {
  "Preparatory Prayers": "Au réveil", "The Midnight Rite": "Tikoun Hatsot", "Weekday Shacharit": "Chaharit de semaine",
  "Additions for Shacharit": "Après Chaharit", "Weekday Mincha": "Minha de semaine", "Weekday Arvit": "Arvit de semaine",
  "Counting of the Omer": "Compte du Omer", "Blessing of the Moon": "Birkat Halevana", "Bedtime Shema": "Chema du coucher",
  "Shabbat Candle Lighting": "Allumage des bougies", "Song of Songs": "Chir Hachirim", "Kabbalat Shabbat": "Kabbalat Chabbat",
  "Shabbat Arvit": "Arvit de Chabbat", "Shabbat Evening": "Vendredi soir à table", "Post Meal Blessing": "Birkat Hamazon",
  "Al Hamihya": "Al Hamih'ya (Méèn Chaloch)", "Blessings on Enjoyments": "Bénédictions sur les aliments", "Shabbat Shacharit": "Chaharit de Chabbat",
  "Shabbat Mussaf": "Moussaf de Chabbat", "Daytime Meal": "Repas du jour", "Shabbat Mincha": "Minha de Chabbat", "Third Meal": "Séouda Chelichit",
  "Havdalah": "Motsaé Chabbat · Havdala", "Rosh Hodesh": "Roch Hodech", "Prayers for Three Festivals": "Les trois fêtes (Chalch Régalim)",
  "Hanukkah": "Hanoucca", "Purim": "Pourim", "Nissan": "Mois de Nissan", "Assorted Blessings and Prayers": "Bénédictions et prières diverses",
  "Fast Days and Mourning": "Jeûnes et deuil", "Mishna Study for Shabbat": "Étude de Michna pour Chabbat",

  "Modeh Ani": "Modé Ani", "Morning Blessings": "Bénédictions du matin", "Torah Blessings": "Bénédictions de la Torah",
  "LeShem Yichud": "Léchem Yihoud", "Tikkun Rachel": "Tikoun Rahel", "Tikkun Leah": "Tikoun Léa",
  "Petichat Eliyahu": "Pétihat Eliyahou", "Order of Talit": "Le Talith", "Order of Tefillin": "Les Téfilines", "Hanna's Prayer": "Prière de Hanna",
  "Morning Prayer": "Prière du matin", "Incense Offering": "Pitoum Hakétoret", "Hodu": "Hodou", "Pesukei D'Zimra": "Pessouké Dezimra",
  "The Shema": "Chema et ses bénédictions", "Amida": "Amida", "Amidah": "Amida", "Vidui": "Vidouy", "Torah Reading": "Lecture de la Torah",
  "Ashrei": "Achré", "Uva LeSion": "Ouva Létsion", "Beit Yaakov": "Beth Yaakov", "Song of the Day": "Psaume du jour", "Kaveh": "Kavé",
  "Alenu": "Alénou", "Thirteen Principles of Faith": "Les 13 principes de foi", "Ten Remembrances": "Les 10 souvenirs", "Offerings": "Korbanot",
  "Barchu": "Barekhou", "Magen Avot": "Maguen Avot", "Shalom Alekhem": "Chalom Alékhem", "Eshet Hayil": "Echet Hayil",
  "Atkenu Seudata": "Atkinou Séoudata", "Kiddush": "Kiddouch", "Blessing of Children": "Bénédiction des enfants", "First Meal": "Premier repas",
  "Zohar": "Zohar", "Songs for Shabbat": "Chants de Chabbat", "Psalms for Shabbat": "Psaumes de Chabbat", "HaGomel": "Birkat Hagomel",
  "Zeved HaBat": "Naissance d'une fille (Zéved Habat)", "Shabbat Chatan": "Chabbat du marié", "Haftarah": "Bénédictions de la Haftara",
  "Birkat HaChodesh": "Annonce du nouveau mois", "Announcement of Fast": "Annonce d'un jeûne", "Mi Sheberach": "Mi Chébérakh",
  "Second Meal": "Deuxième repas", "Before Havdalah": "Avant la Havdala", "Havdala": "La Havdala", "Motzei Shabbat Songs": "Chants de Motsaé Chabbat",
  "Veyiten Lecha": "Véyitèn Lekha", "Fourth Meal": "Mélavé Malka", "Hallel": "Hallel", "Barchi Nafshi": "Barkhi Nafchi", "Mussaf": "Moussaf",
  "Song for Passover": "Psaume de Pessah", "Song for Shavuot": "Psaume de Chavouot", "Song for Sukkot": "Psaume de Souccot",
  "Song for Shemini Atzeret": "Psaume de Chemini Atséret", "Menorah Lighting": "Allumage de la Hanoukia", "Shacharit": "Chaharit",
  "Shabbat Zachor": "Chabbat Zakhor", "Fast of Esther": "Jeûne d'Esther", "Megillah Reading": "Lecture de la Méguila", "Purim Day": "Jour de Pourim",
  "Blessing of the Trees": "Bénédiction des arbres", "Pirkei Avot": "Pirké Avot", "Learning of the Day": "Étude du jour",
  "Blessings on Lighting and Thunder": "Éclairs et tonnerre", "Brit Mila": "Brit Mila", "Building a Fence": "Construire une barrière",
  "Marriage": "Mariage", "Mezuza": "Mezouza", "Mourning": "Deuil", "Prayer for Taking Medicine": "Avant un médicament", "Rainbow": "Arc-en-ciel",
  "Redeeming the First Born": "Pidyon Habén", "Separating Hallah": "Prélèvement de la Hala", "Separating Tithes": "Prélèvement des dîmes",
  "Seventeenth of Tammuz": "17 Tamouz", "Sheva Berachot": "Chéva Berakhot", "Tenth of Tevet": "10 Tévet", "Fast of Gedalya": "Jeûne de Guédalia",
  "Tevillat Kelim": "Tevilat Kélim", "Torah Reading for Fast Days": "Lecture de la Torah des jeûnes", "Traveler's Prayer": "Téfilat Hadérekh"
};
export const fr = (en: string) => FR[en] || en;

export type Category = { id: string; label: string; he: string; icon: string; sections: string[] };
export const CATEGORIES: Category[] = [
  { id: "semaine", label: "Semaine", he: "ימי החול", icon: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    sections: ["Preparatory Prayers", "Weekday Shacharit", "Additions for Shacharit", "Weekday Mincha", "Weekday Arvit", "Bedtime Shema", "The Midnight Rite"] },
  { id: "chabbat", label: "Chabbat", he: "שבת קודש", icon: "M8 21h8M9 21V11h6v10M12 11V8m0-5c1.5 1.5 1.5 3.5 0 5-1.5-1.5-1.5-3.5 0-5Z",
    sections: ["Shabbat Candle Lighting", "Song of Songs", "Kabbalat Shabbat", "Shabbat Arvit", "Shabbat Evening", "Shabbat Shacharit", "Shabbat Mussaf",
      "Daytime Meal", "Shabbat Mincha", "Third Meal", "Havdalah", "Mishna Study for Shabbat"] },
  { id: "fetes", label: "Fêtes et mois", he: "מועדים", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
    sections: ["Rosh Hodesh", "Prayers for Three Festivals", "Hanukkah", "Purim", "Nissan", "Counting of the Omer", "Blessing of the Moon", "Fast Days and Mourning"] },
  { id: "berakhot", label: "Bénédictions", he: "ברכות", icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
    sections: ["Post Meal Blessing", "Al Hamihya", "Blessings on Enjoyments", "Assorted Blessings and Prayers"] }
];

/** Ce qu'on prie maintenant (heure de l'appareil) : un raccourci en haut du Siddour. */
export function suggestion(now = new Date()): { section: string; leaf?: string; label: string } {
  const h = now.getHours(), wd = now.getDay();
  if (wd === 5 && h >= 15) return { section: "Kabbalat Shabbat", label: "Kabbalat Chabbat" };
  if (wd === 6) return h < 12 ? { section: "Shabbat Shacharit", label: "Chaharit de Chabbat" } : h < 17 ? { section: "Shabbat Mincha", label: "Minha de Chabbat" } : { section: "Havdalah", label: "Havdala" };
  if (h < 12) return { section: "Weekday Shacharit", label: "Chaharit" };
  if (h < 17) return { section: "Weekday Mincha", label: "Minha" };
  if (h < 23) return { section: "Weekday Arvit", label: "Arvit" };
  return { section: "Bedtime Shema", label: "Chema du coucher" };
}
