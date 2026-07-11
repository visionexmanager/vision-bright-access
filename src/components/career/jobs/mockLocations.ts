import type { CountryStat } from "./types";

export const POPULAR_COUNTRIES: CountryStat[] = [
  {
    id: "us", name: "United States", jobCount: 12480,
    cities: [
      { id: "sf", name: "San Francisco", jobCount: 2140 },
      { id: "nyc", name: "New York", jobCount: 3025 },
      { id: "austin", name: "Austin", jobCount: 1180 },
    ],
  },
  {
    id: "gb", name: "United Kingdom", jobCount: 6720,
    cities: [
      { id: "london", name: "London", jobCount: 4210 },
      { id: "manchester", name: "Manchester", jobCount: 980 },
    ],
  },
  {
    id: "de", name: "Germany", jobCount: 5390,
    cities: [
      { id: "berlin", name: "Berlin", jobCount: 2680 },
      { id: "munich", name: "Munich", jobCount: 1450 },
    ],
  },
  {
    id: "ca", name: "Canada", jobCount: 4970,
    cities: [
      { id: "toronto", name: "Toronto", jobCount: 2310 },
      { id: "vancouver", name: "Vancouver", jobCount: 1120 },
    ],
  },
  {
    id: "ae", name: "United Arab Emirates", jobCount: 3860,
    cities: [
      { id: "dubai", name: "Dubai", jobCount: 2740 },
      { id: "abudhabi", name: "Abu Dhabi", jobCount: 940 },
    ],
  },
  {
    id: "au", name: "Australia", jobCount: 3510,
    cities: [
      { id: "sydney", name: "Sydney", jobCount: 1690 },
      { id: "melbourne", name: "Melbourne", jobCount: 1330 },
    ],
  },
  {
    id: "sa", name: "Saudi Arabia", jobCount: 2980,
    cities: [
      { id: "riyadh", name: "Riyadh", jobCount: 1740 },
      { id: "jeddah", name: "Jeddah", jobCount: 860 },
    ],
  },
  {
    id: "jp", name: "Japan", jobCount: 2410,
    cities: [
      { id: "tokyo", name: "Tokyo", jobCount: 1580 },
      { id: "osaka", name: "Osaka", jobCount: 610 },
    ],
  },
];
