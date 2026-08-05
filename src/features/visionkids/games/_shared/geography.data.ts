/**
 * Country/capital/continent facts for the geography-quiz game. Proper nouns
 * stay in English, the same precedent flags.data.ts set.
 */
export interface CountryEntry {
  country: string;
  capital: string;
  continent: string;
  flag: string;
}

export const COUNTRIES: CountryEntry[] = [
  { country: "Egypt", capital: "Cairo", continent: "Africa", flag: "🇪🇬" },
  { country: "Saudi Arabia", capital: "Riyadh", continent: "Asia", flag: "🇸🇦" },
  { country: "Japan", capital: "Tokyo", continent: "Asia", flag: "🇯🇵" },
  { country: "France", capital: "Paris", continent: "Europe", flag: "🇫🇷" },
  { country: "Germany", capital: "Berlin", continent: "Europe", flag: "🇩🇪" },
  { country: "Italy", capital: "Rome", continent: "Europe", flag: "🇮🇹" },
  { country: "Spain", capital: "Madrid", continent: "Europe", flag: "🇪🇸" },
  { country: "Brazil", capital: "Brasília", continent: "South America", flag: "🇧🇷" },
  { country: "Canada", capital: "Ottawa", continent: "North America", flag: "🇨🇦" },
  { country: "Mexico", capital: "Mexico City", continent: "North America", flag: "🇲🇽" },
  { country: "Australia", capital: "Canberra", continent: "Oceania", flag: "🇦🇺" },
  { country: "India", capital: "New Delhi", continent: "Asia", flag: "🇮🇳" },
  { country: "China", capital: "Beijing", continent: "Asia", flag: "🇨🇳" },
  { country: "Kenya", capital: "Nairobi", continent: "Africa", flag: "🇰🇪" },
  { country: "Morocco", capital: "Rabat", continent: "Africa", flag: "🇲🇦" },
  { country: "Turkey", capital: "Ankara", continent: "Asia", flag: "🇹🇷" },
  { country: "Portugal", capital: "Lisbon", continent: "Europe", flag: "🇵🇹" },
  { country: "Argentina", capital: "Buenos Aires", continent: "South America", flag: "🇦🇷" },
  { country: "Norway", capital: "Oslo", continent: "Europe", flag: "🇳🇴" },
  { country: "Jordan", capital: "Amman", continent: "Asia", flag: "🇯🇴" },
];

export const CAPITALS = COUNTRIES.map((c) => c.capital);
export const COUNTRY_NAMES = COUNTRIES.map((c) => c.country);
export const CONTINENTS = [...new Set(COUNTRIES.map((c) => c.continent))];
