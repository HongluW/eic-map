/**
 * The Anarchy Atlas — an animated historical map of the East India Company's rise, 1739–1803,
 * following the narrative of William Dalrymple's "The Anarchy".
 *
 * Single-file React component. Dependencies: react, lucide-react, Tailwind CSS (utility classes).
 * Geography (Natural Earth 1:50m coastline + generated historic regions) is embedded at the
 * bottom of this file and can be regenerated with `node scripts/build-geo.mjs`.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Swords, Castle, ScrollText, Flame, Crown, Anchor,
  Wheat, Skull, Footprints, Landmark, X, LocateFixed, Plus, Minus, ChevronUp, ChevronDown,
  Ship, BookOpen, Users, Map as MapIcon, Layers, RotateCcw, Sailboat, Coins, Package,
} from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════════════
   1 · FACTIONS
   ════════════════════════════════════════════════════════════════════════════ */

const FACTIONS = {
  eic:       { name: 'East India Company',     short: 'Company',   color: '#7790b4', ink: '#34507a', blurb: 'A London joint-stock company of merchants that, within a lifetime, raised a private army larger than the British Army and took over the revenues of Bengal.' },
  mughal:    { name: 'Mughal Empire',          short: 'Mughal',    color: '#d8b25e', ink: '#86621c', blurb: 'The Timurid dynasty of Delhi, still the fount of legitimacy in India even as its real power shrank to the walls of the Red Fort.' },
  maratha:   { name: 'Maratha Confederacy',    short: 'Maratha',   color: '#cd8a52', ink: '#874620', blurb: 'The Peshwas of Poona and the great chiefs — Scindia, Holkar, Bhonsle, Gaekwad — whose cavalry dominated India from the Deccan to the Punjab.' },
  bengal:    { name: 'Nawabs of Bengal',       short: 'Bengal',    color: '#86a77c', ink: '#3f6537', blurb: 'Rulers of the richest province of the empire from Murshidabad: Alivardi Khan, Siraj-ud-Daula and the puppet Nawabs who followed Plassey.' },
  afghan:    { name: 'Persians & Afghans',     short: 'Afghan',    color: '#a8926a', ink: '#62512f', blurb: 'Nadir Shah of Persia, who sacked Delhi in 1739, and his heir in the east, Ahmad Shah Durrani, founder of the Afghan empire.' },
  french:    { name: 'French Compagnie des Indes', short: 'French', color: '#9b8bbd', ink: '#52457e', blurb: 'The Company\'s great rival, directed from Pondicherry. Under Dupleix and Bussy it pioneered the use of European-drilled sepoys in Indian politics.' },
  hyderabad: { name: 'Nizam of Hyderabad',     short: 'Hyderabad', color: '#bb8796', ink: '#77404f', blurb: 'The Asaf Jahi state of the Deccan, founded by the Mughal viceroy Nizam-ul-Mulk; courted in turn by the French, the Marathas and the Company.' },
  mysore:    { name: 'Sultanate of Mysore',    short: 'Mysore',    color: '#b06a55', ink: '#6e2f20', blurb: 'Hyder Ali and his son Tipu Sultan built a modern fiscal-military state in the south and fought the Company in four wars.' },
  awadh:     { name: 'Nawabs of Awadh',        short: 'Awadh',     color: '#71a3a6', ink: '#2f6466', blurb: 'The Nawab-Wazirs of Lucknow and Faizabad — Safdar Jang, Shuja-ud-Daula, Asaf-ud-Daula — wealthy allies, enemies and finally clients of the Company.' },
  crown:     { name: 'British Raj (the Crown)', short: 'Raj',  color: '#b8475a', ink: '#6b1c2a', blurb: 'From 1858 the British Crown governs India directly. Ceylon was already a Crown colony from 1802.' },
  other:     { name: 'Other states',           short: 'Other',     color: '#d9ccb2', ink: '#6d5d48', blurb: 'Rajputs, Sikhs, Rohillas, the Nawabs of Arcot, Travancore and many others.' },
};
const MAIN = ['eic', 'mughal', 'maratha', 'bengal'];
const ALL_FORCES = ['eic', 'mughal', 'maratha', 'afghan', 'french', 'bengal', 'hyderabad', 'mysore', 'awadh'];
const MUTED = '#e6dcc8';
const PAPER = '#F1EADB'; // map ground; the edge mist fades into this
const RAJ = 1858.83; // Queen Victoria's Proclamation, 1 November 1858: Company territory passes to the Crown

/* ════════════════════════════════════════════════════════════════════════════
   2 · ERAS (chapters of the narrative)
   ════════════════════════════════════════════════════════════════════════════ */

const T0 = 1739, T1 = 1859;
// The timeline is piecewise: the main story (1739–1805) gets most of the width, the epilogue is compressed.
const TX_SPLIT = 1805, TX_FRAC = 0.86;
const tx = (t) => (t <= TX_SPLIT ? ((t - T0) / (TX_SPLIT - T0)) * TX_FRAC : TX_FRAC + ((t - TX_SPLIT) / (T1 - TX_SPLIT)) * (1 - TX_FRAC));
const txInv = (f) => (f <= TX_FRAC ? T0 + (f / TX_FRAC) * (TX_SPLIT - T0) : TX_SPLIT + ((f - TX_FRAC) / (1 - TX_FRAC)) * (T1 - TX_SPLIT));
const ERAS = [
  { title: 'The Sack of Delhi',           sub: 'Nadir Shah and the unravelling of Mughal power',          from: 1739,   to: 1746 },
  { title: 'Dupleix & the Carnatic',      sub: 'The European companies learn to make war in India',       from: 1746,   to: 1756 },
  { title: 'Plassey',                     sub: 'Siraj-ud-Daula, Clive and the conspiracy',                from: 1756,   to: 1758 },
  { title: 'Puppets & Panipat',           sub: 'Bengal plundered; the Marathas broken in the north',      from: 1758,   to: 1764 },
  { title: 'Buxar & the Diwani',          sub: 'A trading company becomes a ruler',                       from: 1764,   to: 1769.4 },
  { title: 'Famine & the Return',         sub: 'Bengal starves; Shah Alam goes home to Delhi',            from: 1769.4, to: 1772.3 },
  { title: 'Hastings at Bay',             sub: 'Marathas, Mysore and the near-collapse of 1780',          from: 1772.3, to: 1786 },
  { title: 'Cornwallis & the Tiger',      sub: 'Ghulam Qadir, Tipu Sultan and a new Company state',       from: 1786,   to: 1798 },
  { title: "Wellesley's Wars",            sub: 'Seringapatam, Assaye and the taking of Delhi',            from: 1798,   to: 1804 },
  { title: 'Epilogue: the Raj',           sub: 'The conquest is completed, and the Crown takes over',     from: 1804,   to: 1859, ep: true },
];
const eraAt = (t) => ERAS.find((e) => t >= e.from && t < e.to) || ERAS[ERAS.length - 1];

/* ════════════════════════════════════════════════════════════════════════════
   3 · PLACES  [name, lon, lat, major?, labelLeft?]
   ════════════════════════════════════════════════════════════════════════════ */

const PLACES = {
  kabul: ['Kabul', 69.18, 34.53, 2], kandahar: ['Kandahar', 65.71, 31.61, 1], peshawar: ['Peshawar', 71.58, 34.01, 1],
  lahore: ['Lahore', 74.35, 31.56, 2], sirhind: ['Sirhind', 76.38, 30.64], manupur: ['Manupur', 76.43, 30.72],
  karnal: ['Karnal', 76.98, 29.69], panipat: ['Panipat', 76.97, 29.39, 0, 1], delhi: ['Delhi', 77.21, 28.65, 2],
  mathura: ['Mathura', 77.67, 27.49, 0, 1], agra: ['Agra', 78.01, 27.18, 1], aligarh: ['Aligarh', 78.08, 27.88],
  laswari: ['Laswari', 76.85, 27.55, 0, 1], gwalior: ['Gwalior', 78.18, 26.22, 1], salbai: ['Salbai', 78.0, 25.95, 0, 1],
  katra: ['Miranpur Katra', 79.66, 28.03], kalpi: ['Kalpi', 79.73, 26.12], kanpur: ['Cawnpore', 80.33, 26.45],
  jajmau: ['Kora', 80.42, 26.2], lucknow: ['Lucknow', 80.95, 26.85, 2], faizabad: ['Faizabad', 82.14, 26.78],
  allahabad: ['Allahabad', 81.85, 25.44, 1], benares: ['Benares', 83.0, 25.32, 1], buxar: ['Buxar', 83.98, 25.57],
  patna: ['Patna', 85.14, 25.61, 2], udhuanala: ['Udhua Nala', 87.73, 25.03], giria: ['Giria', 88.08, 24.47, 0, 1],
  murshidabad: ['Murshidabad', 88.27, 24.18, 2, 1], plassey: ['Plassey', 88.25, 23.8, 0, 1], katwa: ['Katwa', 88.13, 23.65, 0, 1],
  burdwan: ['Burdwan', 87.86, 23.24, 0, 1], chandernagore: ['Chandernagore', 88.38, 22.87], calcutta: ['Calcutta', 88.36, 22.57, 2],
  dhaka: ['Dhaka', 90.41, 23.81, 1], cuttack: ['Cuttack', 85.88, 20.46, 1], nagpur: ['Nagpur', 79.09, 21.15, 1],
  argaon: ['Argaon', 77.05, 21.08], surji: ['Surji-Anjangaon', 77.4, 21.25], assaye: ['Assaye', 75.88, 20.25],
  burhanpur: ['Burhanpur', 76.23, 21.31], bhopal: ['Bhopal', 77.41, 23.26], ujjain: ['Ujjain', 75.78, 23.18, 1, 1],
  indore: ['Indore', 75.86, 22.72], surat: ['Surat', 72.83, 21.17, 1, 1], bassein: ['Bassein', 72.82, 19.33, 0, 1],
  bombay: ['Bombay', 72.84, 18.96, 2, 1], wadgaon: ['Wadgaon', 73.64, 18.74], poona: ['Poona', 73.86, 18.52, 2],
  kharda: ['Kharda', 75.48, 18.64], ahmednagar: ['Ahmednagar', 74.74, 19.09], hyderabad: ['Hyderabad', 78.47, 17.38, 2],
  masulipatam: ['Masulipatam', 81.13, 16.17, 1], bellary: ['Bellary', 76.92, 15.14], chittoor: ['Chittoor', 79.1, 13.22],
  madras: ['Madras', 80.27, 13.08, 2], adyar: ['Adyar', 80.25, 13.0], pollilur: ['Pollilur', 79.7, 12.87, 0, 1],
  arcot: ['Arcot', 79.32, 12.9, 1, 1], vellore: ['Vellore', 79.13, 12.92, 0, 1], ambur: ['Ambur', 78.72, 12.79, 0, 1],
  wandiwash: ['Wandiwash', 79.6, 12.5], gingee: ['Gingee', 79.42, 12.25, 0, 1], tiruvannamalai: ['Tiruvannamalai', 79.07, 12.23, 0, 1],
  pondicherry: ['Pondicherry', 79.83, 11.93, 1], cuddalore: ['Fort St David', 79.77, 11.75], portonovo: ['Porto Novo', 79.77, 11.5],
  trichinopoly: ['Trichinopoly', 78.69, 10.8, 1, 1], tanjore: ['Tanjore', 79.13, 10.79], bangalore: ['Bangalore', 77.59, 12.97, 1],
  seringapatam: ['Seringapatam', 76.68, 12.42, 2, 1], mangalore: ['Mangalore', 74.86, 12.87, 0, 1], cannanore: ['Cannanore', 75.37, 11.87, 0, 1],
  calicut: ['Calicut', 75.78, 11.25, 1, 1], travlines: ['Travancore Lines', 76.3, 10.3, 0, 1],
  meerut: ['Meerut', 77.71, 28.98], karachi: ['Karachi', 67.0, 24.86, 0, 1], miani: ['Miani', 68.4, 25.5],
};

/* Small European enclaves drawn as blobs: [name, lon, lat, control[]] */
const ENCLAVES = {
  fortwilliam: ['Fort William', 88.36, 22.57, [[1739, 'eic'], [1756.47, 'bengal'], [1757.0, 'eic']]],
  chandernagore: ['Chandernagore', 88.38, 22.87, [[1739, 'french'], [1757.22, 'eic'], [1765.3, 'french'], [1778.6, 'eic'], [1785.3, 'french'], [1793.4, 'eic'], [1816.9, 'french']]],
  madras: ['Fort St George', 80.27, 13.08, [[1739, 'eic'], [1746.72, 'french'], [1749.6, 'eic']]],
  fortstdavid: ['Fort St David', 79.77, 11.75, [[1739, 'eic'], [1758.42, 'french'], [1760.6, 'eic']]],
  pondicherry: ['Pondicherry', 79.83, 11.93, [[1739, 'french'], [1761.04, 'eic'], [1765.3, 'french'], [1778.8, 'eic'], [1785.3, 'french'], [1793.6, 'eic'], [1816.9, 'french']]],
  masulipatam: ['Masulipatam', 81.13, 16.17, [[1739, 'hyderabad'], [1750.6, 'french'], [1759.27, 'eic']]],
  bombay: ['Bombay', 72.84, 18.96, [[1739, 'eic']]],
  salsette: ['Salsette', 72.9, 19.22, [[1739, 'maratha'], [1774.95, 'eic']]],
  goa: ['Goa (Portuguese)', 73.9, 15.45, [[1739, 'other']]],
  tellicherry: ['Tellicherry', 75.49, 11.75, [[1739, 'eic']]],
};

/* ════════════════════════════════════════════════════════════════════════════
   4 · REGIONS & TERRITORIAL CONTROL
   control entries: [fromYear, faction, overlord?, note?]
   ════════════════════════════════════════════════════════════════════════════ */

const REGIONS = {
  kashmir:     { name: 'Kashmir',          ctl: [[1739, 'mughal'], [1752.3, 'afghan'], [1819.5, 'other', null, 'Sikh Empire of Ranjit Singh'], [1846.2, 'other', 'eic', 'Jammu & Kashmir (Gulab Singh), British protectorate']] },
  peshawar:    { name: 'Peshawar',         ctl: [[1739, 'mughal'], [1739.37, 'afghan'], [1834.4, 'other', null, 'Sikh Empire of Ranjit Singh'], [1849.24, 'eic']] },
  punjab:      { name: 'Punjab',           ctl: [[1739, 'mughal'], [1752.3, 'afghan'], [1758.3, 'maratha'], [1761.04, 'afghan'], [1765.3, 'other', null, 'Sikh misls'], [1799.5, 'other', null, 'Sikh Empire of Ranjit Singh'], [1849.24, 'eic']] },
  sindh:       { name: 'Sindh',            ctl: [[1739, 'other', null, 'Kalhora Sindh'], [1739.37, 'other', 'afghan', 'Kalhora Sindh (tributary)'], [1783, 'other', null, 'Talpur Amirs of Sindh'], [1843.13, 'eic']] },
  balochistan: { name: 'Kalat',            ctl: [[1739, 'other', 'afghan', 'Khanate of Kalat']] },
  hills:       { name: 'Hill States',      small: 1, ctl: [[1739, 'other', null, 'Hill rajas of Garhwal, Kumaon & Kangra'], [1816.2, 'other', 'eic', 'Hill states; Kumaon ceded by Nepal']] },
  delhi:       { name: 'Delhi',            ctl: [[1739, 'mughal'], [1771.9, 'mughal', 'maratha', 'Mughal Emperor under Maratha protection'], [1803.7, 'mughal', 'eic', 'Mughal Emperor under Company protection'], [1803.99, 'eic', null, 'Delhi territory under Company administration'], [1857.36, 'mughal', null, 'Bahadur Shah Zafar, proclaimed by the rebels'], [1857.71, 'eic']] },
  doab:        { name: 'Doab',             small: 1, ctl: [[1739, 'mughal'], [1751, 'maratha'], [1761.04, 'other', null, 'Rohilla & Bangash chiefs'], [1774.3, 'awadh', 'eic'], [1801.86, 'eic']] },
  rohilkhand:  { name: 'Rohilkhand',       ctl: [[1739, 'other', null, 'Rohilla Afghans'], [1774.31, 'awadh', 'eic'], [1801.86, 'eic']] },
  awadh:       { name: 'Awadh',            ctl: [[1739, 'awadh'], [1765.62, 'awadh', 'eic', 'Nawab of Awadh, Company ally'], [1856.12, 'eic', null, 'Annexed by Dalhousie'], [1857.45, 'other', null, 'Rebel Awadh (Begum Hazrat Mahal)'], [1858.2, 'eic']] },
  allahabad:   { name: 'Allahabad',        small: 1, ctl: [[1739, 'mughal'], [1748, 'awadh'], [1765.62, 'mughal', null, 'Granted to Shah Alam II'], [1773.69, 'awadh', 'eic'], [1801.86, 'eic']] },
  benares:     { name: 'Benares',          small: 1, ctl: [[1739, 'awadh'], [1775.4, 'eic', null, 'Raja of Benares, Company zamindar']] },
  bihar:       { name: 'Bihar',            ctl: [[1739, 'bengal'], [1757.48, 'bengal', 'eic', 'Puppet Nawab under Company control'], [1765.62, 'eic', null, 'Company Diwani']] },
  bengal:      { name: 'Bengal',           ctl: [[1739, 'bengal'], [1757.48, 'bengal', 'eic', 'Puppet Nawab under Company control'], [1765.62, 'eic', null, 'Company Diwani']] },
  calcutta:    { name: '24 Parganas',      small: 1, ctl: [[1739, 'bengal'], [1757.95, 'eic', null, 'Company zamindari of the 24 Parganas']] },
  burdwan:     { name: 'Burdwan',          small: 1, ctl: [[1739, 'bengal'], [1757.48, 'bengal', 'eic'], [1760.8, 'eic', null, 'Ceded by Mir Qasim']] },
  chittagong:  { name: 'Chittagong',       small: 1, ctl: [[1739, 'bengal'], [1757.48, 'bengal', 'eic'], [1760.8, 'eic', null, 'Ceded by Mir Qasim']] },
  orissa:      { name: 'Orissa',           ctl: [[1739, 'bengal'], [1751.37, 'maratha', null, 'Bhonsle of Nagpur'], [1803.79, 'eic']] },
  assam:       { name: 'Assam',            ctl: [[1739, 'other', null, 'Ahom kingdom, Manipur & Tripura'], [1817, 'other', null, 'Burmese-occupied Assam'], [1826.15, 'eic']] },
  nepal:       { name: 'Nepal',            ctl: [[1739, 'other', null, 'Hill kingdoms; Gorkha unification from 1768']] },
  bhutan:      { name: 'Bhutan',           small: 1, ctl: [[1739, 'other', null, 'Bhutan']] },
  rajputana:   { name: 'Rajputana',        ctl: [[1739, 'other', null, 'Rajput kingdoms'], [1750, 'other', 'maratha', 'Rajput kingdoms paying Maratha tribute'], [1818.1, 'other', 'eic', 'Rajput states under British protection']] },
  gujarat:     { name: 'Gujarat',          ctl: [[1739, 'mughal'], [1753.3, 'maratha', null, 'Peshwa & Gaekwad'], [1802.3, 'maratha', 'eic', 'Gaekwad of Baroda, Company ally'], [1818.45, 'eic', 'eic', 'Company Gujarat & Baroda state']] },
  surat:       { name: 'Surat',            small: 1, ctl: [[1739, 'mughal'], [1759.2, 'eic', null, 'Surat castle held by the Company']] },
  malwa:       { name: 'Malwa',            ctl: [[1739, 'maratha', null, 'Scindia & Holkar'], [1818.0, 'maratha', 'eic', 'Scindia & Holkar, British protectorates']] },
  bundelkhand: { name: 'Bundelkhand',      small: 1, ctl: [[1739, 'other', 'maratha', 'Bundela rajas'], [1803.99, 'eic', null, 'Ceded by the Peshwa (1803)']] },
  nagpur:      { name: 'Berar & Nagpur',   ctl: [[1739, 'maratha', null, 'Bhonsle of Nagpur'], [1816.4, 'maratha', 'eic', 'Bhonsle under subsidiary alliance'], [1854.2, 'eic', null, 'Annexed by lapse (1854)']] },
  deccan:      { name: 'Deccan',           ctl: [[1739, 'maratha', null, "The Peshwa's homeland"], [1802.99, 'maratha', 'eic', 'Peshwa under subsidiary alliance'], [1818.42, 'eic', null, 'Bombay Presidency (Deccan)']] },
  konkan:      { name: 'Konkan',           small: 1, ctl: [[1739, 'maratha'], [1802.99, 'maratha', 'eic'], [1818.42, 'eic', null, 'Bombay Presidency']] },
  hyderabad:   { name: 'Hyderabad',        ctl: [[1739, 'hyderabad'], [1751.12, 'hyderabad', 'french', 'Nizam with French subsidiary corps'], [1758.6, 'hyderabad'], [1798.81, 'hyderabad', 'eic', 'Nizam under Company subsidiary alliance']] },
  circars:     { name: 'Northern Circars', small: 1, ctl: [[1739, 'hyderabad'], [1753.92, 'french'], [1759.27, 'hyderabad'], [1766.86, 'eic']] },
  ceded:       { name: 'Bellary & Cuddapah', small: 1, ctl: [[1739, 'hyderabad'], [1779, 'mysore'], [1792.21, 'hyderabad'], [1800.78, 'eic', null, 'The Ceded Districts']] },
  carnatic:    { name: 'Carnatic',         ctl: [[1739, 'other', null, 'Nawab of Arcot'], [1749.59, 'other', 'french', 'Chanda Sahib, French client'], [1752.45, 'other', 'eic', 'Muhammad Ali, Company client'], [1801.58, 'eic']] },
  tanjore:     { name: 'Tanjore',          small: 1, ctl: [[1739, 'other', null, 'Maratha Rajas of Tanjore'], [1799.8, 'eic']] },
  jagir:       { name: 'Madras Jagir',     small: 1, ctl: [[1739, 'other', null, 'Nawab of Arcot'], [1763.5, 'eic', null, 'Chingleput jagir']] },
  mysore:      { name: 'Mysore',           ctl: [[1739, 'mysore', null, 'Wodeyar kingdom'], [1761.5, 'mysore', null, 'Hyder Ali'], [1782.93, 'mysore', null, 'Tipu Sultan'], [1799.34, 'other', 'eic', 'Wodeyar Mysore, Company protectorate'], [1831.8, 'eic', null, 'Mysore under Company commissioners (1831)']] },
  baramahal:   { name: 'Baramahal',        small: 1, ctl: [[1739, 'mysore'], [1792.21, 'eic']] },
  coimbatore:  { name: 'Coimbatore',       small: 1, ctl: [[1739, 'mysore'], [1799.34, 'eic']] },
  malabar:     { name: 'Malabar',          small: 1, ctl: [[1739, 'other', null, 'Zamorin & Malabar chiefs'], [1766.3, 'mysore'], [1792.21, 'eic']] },
  canara:      { name: 'Canara',           small: 1, ctl: [[1739, 'other', null, 'Keladi Nayakas of Bednur'], [1763.1, 'mysore'], [1799.34, 'eic']] },
  travancore:  { name: 'Travancore',       small: 1, ctl: [[1739, 'other', null, 'Kingdom of Travancore'], [1795, 'other', 'eic', 'Travancore, Company ally']] },
  ceylon:      { name: 'Ceylon',           ctl: [[1739, 'other', null, 'Dutch coast & Kingdom of Kandy'], [1796.1, 'other', 'eic', 'British coast & Kingdom of Kandy'], [1802.2, 'crown', null, 'British Crown colony (Kandy taken 1815)']] },
  afghanistan: { name: 'Afghanistan',      ctl: [[1739, 'afghan']] },
  persia:      { name: 'Persia',           ctl: [[1739, 'afghan', null, 'Afsharid Persia of Nadir Shah'], [1747.47, 'other', null, 'Persia after Nadir']] },
};
const SUBCONTINENT_EXCLUDE = new Set(['afghanistan', 'persia']);

function regionState(id, t) {
  const ctl = REGIONS[id].ctl;
  let e = ctl[0];
  for (const c of ctl) if (c[0] <= t) e = c; else break;
  const raj = (f) => (t >= RAJ && f === 'eic' ? 'crown' : f);
  return { f: raj(e[1]), over: e[2] ? raj(e[2]) : null, note: t >= RAJ && e[1] === 'eic' ? 'British India, under the Crown' : e[3] || null, since: e[0] };
}
function enclaveState(id, t) {
  const ctl = ENCLAVES[id][3];
  let e = ctl[0];
  for (const c of ctl) if (c[0] <= t) e = c; else break;
  return t >= RAJ && e[1] === 'eic' ? 'crown' : e[1];
}

/* ════════════════════════════════════════════════════════════════════════════
   5 · RULERS & OFFICES  holders: [from, to, name, note?]
   ════════════════════════════════════════════════════════════════════════════ */

const OFFICES = [
  { f: 'eic', title: 'Senior Company governor', holders: [
    [1735, 1744.0, 'Richard Benyon', 'Governor of Madras'], [1744.0, 1746.72, 'Nicholas Morse', 'Governor of Madras'],
    [1746.72, 1750.3, 'Council at Fort St David', 'Madras in French hands'], [1750.3, 1755.1, 'Thomas Saunders', 'Governor of Madras'],
    [1755.1, 1757.48, 'George Pigot', 'Governor of Madras · Roger Drake at Calcutta'], [1757.48, 1760.1, 'Robert Clive', 'Governor of Bengal'],
    [1760.1, 1760.55, 'John Zephaniah Holwell', 'Acting Governor of Bengal'], [1760.55, 1764.9, 'Henry Vansittart', 'Governor of Bengal'],
    [1764.9, 1765.3, 'John Spencer', 'Governor of Bengal'], [1765.3, 1767.08, 'Robert Clive', 'Governor of Bengal, second term'],
    [1767.08, 1769.98, 'Harry Verelst', 'Governor of Bengal'], [1769.98, 1772.28, 'John Cartier', 'Governor of Bengal'],
    [1772.28, 1785.1, 'Warren Hastings', 'Governor of Bengal; first Governor-General from 1774'], [1785.1, 1786.7, 'Sir John Macpherson', 'Acting Governor-General'],
    [1786.7, 1793.8, 'Charles, Earl Cornwallis', 'Governor-General'], [1793.8, 1798.37, 'Sir John Shore', 'Governor-General'],
    [1798.37, 1805.58, 'Richard Wellesley', 'Governor-General (Earl of Mornington; Marquess Wellesley from 1799)'],
    [1805.58, 1805.76, 'Charles, Marquess Cornwallis', 'second term; dies at Ghazipur'], [1805.76, 1807.55, 'Sir George Barlow', 'acting'],
    [1807.55, 1813.76, 'Lord Minto', 'Governor-General'], [1813.76, 1823.0, 'Marquess of Hastings', 'Governor-General'],
    [1823.6, 1828.2, 'Lord Amherst', 'Governor-General'], [1828.5, 1835.2, 'Lord William Bentinck', 'Governor-General'],
    [1836.2, 1842.1, 'Lord Auckland', 'Governor-General'], [1842.1, 1844.5, 'Lord Ellenborough', 'Governor-General'],
    [1844.5, 1848.0, 'Sir Henry Hardinge', 'Governor-General'], [1848.0, 1856.15, 'Marquess of Dalhousie', 'Governor-General'],
    [1856.15, RAJ, 'Viscount Canning', 'last Governor-General under the Company'] ] },
  { f: 'eic', title: 'Commanders in the field', holders: [
    [1748, 1759, 'Stringer Lawrence', 'Commander, Madras'], [1751.6, 1760.1, 'Robert Clive', 'Arcot, Plassey'], [1759.5, 1762, 'Eyre Coote', 'Wandiwash, Pondicherry'],
    [1763.5, 1764, 'Thomas Adams', 'War with Mir Qasim'], [1764.5, 1765.2, 'Hector Munro', 'Buxar'], [1779.3, 1783.3, 'Sir Eyre Coote', 'Commander-in-Chief'],
    [1778.3, 1781, 'Thomas Goddard', 'March across India'], [1798.9, 1800, 'George Harris', 'Seringapatam'],
    [1799, 1805, 'Arthur Wellesley', 'Mysore & the Deccan'], [1801, 1805.5, 'Gerard Lake', 'Commander-in-Chief'] ] },
  { f: 'mughal', title: 'Mughal Emperor', holders: [
    [1719, 1748.32, 'Muhammad Shah', '"Rangila", r. 1719–48'], [1748.32, 1754.42, 'Ahmad Shah Bahadur', 'deposed & blinded 1754'],
    [1754.42, 1759.91, 'Alamgir II', 'murdered 1759'], [1759.98, 1806.88, 'Shah Alam II', 'r. 1759–1806; blinded 1788'], [1806.88, 1837.75, 'Akbar II', 'Company pensioner'], [1837.75, 1857.72, 'Bahadur Shah II (Zafar)', 'last Mughal emperor; exiled to Rangoon 1858'] ] },
  { f: 'mughal', title: 'Power behind the throne', holders: [
    [1739, 1748.2, 'Qamar-ud-din Khan', 'Wazir'], [1748.4, 1753.5, 'Safdar Jang', 'Wazir (and Nawab of Awadh)'], [1753.9, 1759.98, 'Imad-ul-Mulk', 'Wazir'],
    [1761.1, 1770.8, 'Najib-ud-Daula', 'Rohilla regent of Delhi'], [1772, 1782.3, 'Mirza Najaf Khan', 'Mughal commander-in-chief'],
    [1784.9, 1794.12, 'Mahadji Scindia', 'Vakil-i-Mutlaq (regent)'], [1788.55, 1788.8, 'Ghulam Qadir', 'Rohilla usurper'],
    [1794.12, 1803.7, 'Daulat Rao Scindia', 'through Perron'], [1803.7, 1857.36, 'Company Resident', 'Delhi Residency'] ] },
  { f: 'maratha', title: 'Peshwa', holders: [
    [1720, 1740.32, 'Bajirao I', ''], [1740.48, 1761.48, 'Balaji Bajirao (Nanasaheb)', ''], [1761.48, 1772.88, 'Madhavrao I', ''],
    [1772.88, 1773.66, 'Narayanrao', 'murdered 1773'], [1773.66, 1774.3, 'Raghunathrao', 'disputed'], [1774.3, 1795.82, 'Madhavrao II', 'infant Peshwa; Nana Phadnavis regent'],
    [1796.35, 1818.42, 'Baji Rao II', 'surrendered 1818; office abolished'] ] },
  { f: 'maratha', title: 'Great chiefs', holders: [
    [1731, 1766.4, 'Malhar Rao Holkar', 'Indore'], [1767, 1795.65, 'Ahilyabai Holkar', 'Indore'], [1797.6, 1811, 'Yashwantrao Holkar', 'Indore'],
    [1745.5, 1755.6, 'Jayappa Scindia', 'Gwalior'], [1755.6, 1761.04, 'Jankoji Scindia', 'Gwalior'], [1768, 1794.12, 'Mahadji Scindia', 'Gwalior'],
    [1794.12, 1827, 'Daulat Rao Scindia', 'Gwalior'], [1739, 1755.1, 'Raghuji I Bhonsle', 'Nagpur'], [1755.1, 1772.4, 'Janoji Bhonsle', 'Nagpur'],
    [1772.4, 1788.4, 'Mudhoji Bhonsle', 'Nagpur'], [1788.4, 1816, 'Raghuji II Bhonsle', 'Nagpur'], [1773.7, 1800.2, 'Nana Phadnavis', 'chief minister, Poona'] ] },
  { f: 'bengal', title: 'Nawab of Bengal', holders: [
    [1727, 1739.2, 'Shuja-ud-Din', ''], [1739.2, 1740.28, 'Sarfaraz Khan', ''], [1740.28, 1756.27, 'Alivardi Khan', ''],
    [1756.27, 1757.48, 'Siraj-ud-Daula', ''], [1757.48, 1760.8, 'Mir Jafar', 'installed by the Company'], [1760.8, 1763.6, 'Mir Qasim', ''],
    [1763.6, 1765.1, 'Mir Jafar', 'restored'], [1765.1, 1766.35, 'Najm-ud-Daula', 'pensioner after the Diwani'], [1766.35, 1770.2, 'Saif-ud-Daula', 'pensioner'],
    [1770.2, 1793.7, 'Mubarak-ud-Daula', 'pensioner'], [1793.7, 1810, 'Babar Ali', 'pensioner'] ] },
  { f: 'bengal', title: 'Bankers', holders: [[1739, 1744.5, 'Jagat Seth Fateh Chand', 'Murshidabad'], [1744.5, 1763.8, 'Jagat Seth Mahtab Rai', 'killed by Mir Qasim, 1763']] },
  { f: 'awadh', title: 'Nawab of Awadh', holders: [
    [1722, 1739.21, 'Saadat Khan', ''], [1739.21, 1754.8, 'Safdar Jang', ''], [1754.8, 1775.07, 'Shuja-ud-Daula', ''],
    [1775.07, 1797.7, 'Asaf-ud-Daula', ''], [1797.7, 1798.05, 'Wazir Ali', 'deposed'], [1798.05, 1814.55, 'Saadat Ali Khan II', ''], [1814.55, 1827.8, 'Ghazi-ud-Din Haidar', 'King of Awadh from 1819'], [1827.8, 1837.5, 'Nasir-ud-Din Haidar', ''], [1837.5, 1842.4, 'Muhammad Ali Shah', ''], [1842.4, 1847.1, 'Amjad Ali Shah', ''], [1847.1, 1856.12, 'Wajid Ali Shah', 'deposed 1856'] ] },
  { f: 'hyderabad', title: 'Nizam of Hyderabad', holders: [
    [1724, 1748.42, 'Asaf Jah I (Nizam-ul-Mulk)', ''], [1748.42, 1750.96, 'Nasir Jung', ''], [1750.96, 1751.12, 'Muzaffar Jung', ''],
    [1751.12, 1762.55, 'Salabat Jung', 'with Bussy until 1758'], [1762.55, 1803.6, 'Nizam Ali Khan', ''], [1803.6, 1829.4, 'Sikandar Jah', ''], [1829.4, 1857.4, 'Nasir-ud-Daula', ''], [1857.4, 1869, 'Afzal-ud-Daula', ''] ] },
  { f: 'mysore', title: 'Ruler of Mysore', holders: [
    [1734, 1761.5, 'Krishnaraja Wodeyar II', 'with the Dalwai Nanjaraja'], [1761.5, 1782.93, 'Hyder Ali', 'de facto ruler'],
    [1782.93, 1799.34, 'Tipu Sultan', '"Tiger of Mysore"'], [1799.4, 1868, 'Krishnaraja Wodeyar III', 'Dewan Purnaiah until 1811'] ] },
  { f: 'afghan', title: 'Shah', holders: [
    [1736, 1747.47, 'Nadir Shah', 'Shah of Persia'], [1747.8, 1772.8, 'Ahmad Shah Durrani', 'founder of the Durrani Empire'],
    [1772.8, 1793.4, 'Timur Shah Durrani', ''], [1793.4, 1801.5, 'Zaman Shah Durrani', ''], [1801.5, 1803.6, 'Mahmud Shah Durrani', ''], [1803.6, 1809.4, 'Shah Shuja Durrani', ''], [1809.4, 1818, 'Mahmud Shah Durrani', 'restored'], [1826, 1839.6, 'Dost Mohammad Khan', 'Emir of Kabul'], [1839.6, 1842.3, 'Shah Shuja', 'installed by the British'], [1842.3, 1863, 'Dost Mohammad Khan', 'restored'] ] },
  { f: 'french', title: 'French leadership in India', holders: [
    [1735, 1741.8, 'Pierre Benoît Dumas', 'Governor of Pondicherry'], [1742, 1754.6, 'Joseph-François Dupleix', 'Governor of Pondicherry'],
    [1751, 1758.6, 'Charles de Bussy', 'commander in the Deccan'], [1754.6, 1755.1, 'Charles Godeheu', 'Governor'], [1755.1, 1758.3, 'Duval de Leyrit', 'Governor'],
    [1758.3, 1761.04, 'Comte de Lally', 'Commander-in-chief'], [1765.3, 1777, 'Jean Law de Lauriston', 'Governor of Pondicherry'],
    [1783.2, 1785.1, 'Charles de Bussy', 'returns with French troops'], [1786, 1798.2, 'Michel Raymond', 'French corps at Hyderabad'],
    [1796, 1803.7, 'Pierre Cuillier-Perron', "commander of Scindia's army"] ] },
  { f: 'crown', title: 'The Crown', holders: [[1802.2, 1820.1, 'George III', 'sovereign of Crown Ceylon'], [1858.83, 1901, 'Queen Victoria', 'sovereign of British India'], [1858.83, 1862.2, 'Viscount Canning', 'first Viceroy of India']] },
];

/* ════════════════════════════════════════════════════════════════════════════
   6 · EVENTS
   d: date · p: place id or [lon,lat] · ty: type · f: factions · pv: pivotal
   forces: { f, who, n, label, detail } · moves: { f, path, kind, label }
   ════════════════════════════════════════════════════════════════════════════ */

const EVENTS_RAW = [
  { d: '1739-02-24', p: 'karnal', ty: 'battle', f: ['afghan', 'mughal', 'awadh'], pv: true, title: 'Battle of Karnal',
    sum: 'Nadir Shah of Persia crosses the Khyber and meets the Mughal army 120 km north of Delhi. In about three hours his mounted musketeers and camel-borne swivel guns shatter Muhammad Shah\'s vast, slow-moving host. Saadat Khan of Awadh is captured and the paymaster-general Khan Dauran mortally wounded. The emperor submits.',
    out: 'The myth of Mughal invincibility is broken in a single afternoon.',
    lead: [['Nadir Shah', 'Shah of Persia', 'afghan'], ['Muhammad Shah', 'Mughal Emperor', 'mughal'], ['Nizam-ul-Mulk', 'Mughal grandee', 'hyderabad'], ['Saadat Khan', 'Nawab of Awadh, captured', 'awadh']],
    forces: [{ f: 'afghan', who: 'Nadir Shah', n: 55000, label: 'c. 55,000', detail: 'veteran Qizilbash and Afghan cavalry, jazayirchi musketeers' }, { f: 'mughal', who: 'Muhammad Shah', n: 150000, label: 'c. 150,000+', detail: 'plus an enormous camp of followers (est.)' }],
    moves: [{ f: 'afghan', path: ['kabul', 'peshawar', 'lahore', 'karnal'], kind: 'march', label: 'Nadir Shah', unit: 'heavy' }, { f: 'mughal', path: ['delhi', 'panipat', 'karnal'], kind: 'march', label: 'Muhammad Shah', unit: 'heavy' }] },

  { d: '1739-03-22', p: 'delhi', ty: 'sack', f: ['afghan', 'mughal'], pv: true, title: 'The Sack of Delhi',
    sum: 'Rumours of Nadir\'s death spark attacks on Persian soldiers, and Nadir orders a general massacre. In a single day perhaps 20,000 to 30,000 people in Delhi are killed. Over the following weeks the Mughal treasury is carted away, including Shah Jahan\'s Peacock Throne and the Koh-i-Noor diamond.',
    out: 'The treasury is emptied. The empire never recovers its revenue or its prestige.',
    lead: [['Nadir Shah', 'Shah of Persia', 'afghan'], ['Muhammad Shah', 'Mughal Emperor', 'mughal']],
    forces: [{ f: 'afghan', who: 'Persian army in Delhi', n: 40000, label: 'c. 40,000 (est.)' }] },

  { d: '1739-05-12', p: 'bassein', ty: 'siege', f: ['maratha'], title: 'Marathas take Bassein',
    sum: 'Chimaji Appa, brother of Peshwa Bajirao I, takes the Portuguese fortress of Bassein north of Bombay after a long and costly siege. Maratha power now presses against the Company\'s island of Bombay.',
    lead: [['Chimaji Appa', 'Maratha general', 'maratha'], ['Bajirao I', 'Peshwa', 'maratha']],
    moves: [{ f: 'maratha', path: ['poona', [73.3, 19.0], 'bassein'], kind: 'march', label: 'Chimaji Appa', unit: 'infantry' }] },

  { d: '1739-05-16', p: 'delhi', ty: 'march', f: ['afghan'], title: 'Nadir Shah leaves with the loot',
    sum: 'Nadir marches home with trains of elephants, camels and horses carrying gold, jewels and the Peacock Throne. Muhammad Shah keeps his throne but cedes everything west of the Indus.',
    out: 'Kabul, Peshawar and Sindh pass out of Mughal hands.',
    moves: [{ f: 'afghan', path: ['delhi', 'sirhind', 'lahore', 'peshawar', 'kabul'], kind: 'march', label: 'Treasure train', unit: 'treasure' }] },

  { d: '1740-04-10', p: 'giria', ty: 'battle', f: ['bengal'], title: 'Battle of Giria',
    sum: 'Alivardi Khan, deputy governor of Bihar, rebels against Nawab Sarfaraz Khan and kills him at Giria near Murshidabad, with the backing of the Jagat Seth banking house. He rules Bengal as a virtually independent prince.',
    lead: [['Alivardi Khan', 'new Nawab of Bengal', 'bengal'], ['Sarfaraz Khan', 'Nawab of Bengal, killed', 'bengal'], ['Jagat Seth Fateh Chand', 'banker', 'bengal']],
    moves: [{ f: 'bengal', path: ['patna', [86.9, 25.0], 'giria'], kind: 'march', label: 'Alivardi Khan', unit: 'cavalry' }] },

  { d: '1740-04-28', p: 'poona', ty: 'political', f: ['maratha'], title: 'Death of Peshwa Bajirao I',
    sum: 'The cavalry commander who carried Maratha arms to the gates of Delhi dies on campaign on the Narmada. His son Balaji Bajirao, known as Nanasaheb, becomes Peshwa and presides over the Confederacy\'s greatest expansion.',
    lead: [['Balaji Bajirao', 'new Peshwa', 'maratha']] },

  { d: '1742-04-15', p: 'burdwan', ty: 'march', f: ['maratha', 'bengal'], title: 'The Bargi raids on Bengal',
    sum: 'Raghuji Bhonsle of Nagpur sends Bhaskar Pandit\'s light horse into Bengal. For a decade the "bargis" burn villages and plunder the silk country west of the Hooghly. Calcutta digs the Maratha Ditch around its landward side.',
    lead: [['Raghuji I Bhonsle', 'Raja of Nagpur', 'maratha'], ['Bhaskar Pandit', 'Maratha general', 'maratha'], ['Alivardi Khan', 'Nawab of Bengal', 'bengal']],
    forces: [{ f: 'maratha', who: 'Bhaskar Pandit', n: 25000, label: 'c. 25,000 horse (est.)' }],
    moves: [{ f: 'maratha', path: ['nagpur', [83.4, 21.6], 'cuttack', [87.0, 22.2], 'burdwan'], kind: 'march', label: 'Bhaskar Pandit', unit: 'cavalry' }] },

  { d: '1744-03-31', p: 'murshidabad', ty: 'massacre', f: ['bengal', 'maratha'], title: 'Murder of Bhaskar Pandit',
    sum: 'Unable to beat the raiders in the field, Alivardi invites Bhaskar Pandit and his officers to a parley tent at Mankara and has them cut down. The raids pause, then resume under Raghuji himself.' },

  { d: '1746-09-21', p: 'madras', ty: 'naval', f: ['french', 'eic'], title: 'The French capture Madras',
    sum: 'Britain and France are at war in Europe. Admiral La Bourdonnais sails from Mauritius and bombards Fort St George, which surrenders within days. Dupleix, governor at Pondicherry, overrides the ransom agreement and keeps the town.',
    lead: [['La Bourdonnais', 'French admiral', 'french'], ['Joseph-François Dupleix', 'Governor of Pondicherry', 'french'], ['Nicholas Morse', 'Governor of Madras', 'eic'], ['Robert Clive', 'young Company clerk; escapes to Fort St David', 'eic']],
    forces: [{ f: 'french', who: 'La Bourdonnais', n: 2000, label: 'c. 2,000 & 9 ships (est.)' }, { f: 'eic', who: 'Nicholas Morse', n: 300, label: 'c. 300 garrison' }],
    moves: [{ f: 'french', path: [[62.5, 8.5], [71.5, 6.0], [80.4, 5.3], [82.6, 7.6], [81.4, 11.0], 'madras'], kind: 'naval', label: 'La Bourdonnais', unit: 'warship' }] },

  { d: '1746-11-03', p: 'adyar', ty: 'battle', f: ['french'], pv: true, title: 'Battle of the Adyar',
    sum: 'The Nawab of Arcot sends his son Mahfuz Khan to take Madras for himself. A small French force under the Swiss officer Paradis wades the Adyar river and routs the Nawab\'s army with disciplined volley fire. Every ambitious power in India takes note: a few hundred drilled troops can beat a traditional army many times their size.',
    out: 'The lesson of the Adyar: European-trained infantry is the new key to power in India.',
    lead: [['Louis Paradis', 'French officer', 'french'], ['Anwaruddin Khan', 'Nawab of Arcot', 'other'], ['Mahfuz Khan', 'his son, commanding', 'other']],
    forces: [{ f: 'french', who: 'Louis Paradis', n: 1000, label: 'c. 1,000', detail: 'including c. 300 Europeans' }, { f: 'other', who: 'Mahfuz Khan', n: 10000, label: 'c. 10,000' }] },

  { d: '1747-06-19', p: 'kandahar', ty: 'political', f: ['afghan'], title: 'Nadir Shah murdered; the Durrani Empire',
    sum: 'Nadir Shah is murdered by his own officers in Khorasan. His Afghan cavalry commander Ahmad Khan Abdali secures part of the treasure and is acclaimed king at Kandahar as Ahmad Shah Durrani, founder of an empire that will invade India again and again.',
    lead: [['Ahmad Shah Durrani', 'King of the Afghans', 'afghan']] },

  { d: '1748-03-11', p: 'manupur', ty: 'battle', f: ['mughal', 'afghan'], title: 'Battle of Manupur',
    sum: 'On his first invasion Ahmad Shah Durrani takes Lahore but is checked near Sirhind by a Mughal army under Crown Prince Ahmad, the wazir Qamar-ud-din Khan, who is killed, and his son Mir Mannu. It is the last major Mughal victory in the field.',
    forces: [{ f: 'mughal', who: 'Prince Ahmad & Mir Mannu', n: 60000, label: 'c. 60,000 (est.)' }, { f: 'afghan', who: 'Ahmad Shah Durrani', n: 12000, label: 'c. 12,000 (est.)' }],
    moves: [{ f: 'afghan', path: ['kandahar', 'peshawar', 'lahore', 'manupur'], kind: 'march', label: 'Ahmad Shah Durrani', unit: 'heavy' }, { f: 'mughal', path: ['delhi', 'karnal', 'manupur'], kind: 'march', label: 'Prince Ahmad', unit: 'heavy' }] },

  { d: '1748-04-26', p: 'delhi', ty: 'political', f: ['mughal'], title: 'Death of Muhammad Shah',
    sum: 'Muhammad Shah, patron of music and painting, dies weeks after Manupur. His son Ahmad Shah Bahadur succeeds, and the court dissolves into feuding between rival noble factions.' },

  { d: '1748-06-01', p: 'hyderabad', ty: 'political', f: ['hyderabad', 'french'], title: 'Death of Nizam-ul-Mulk',
    sum: 'Asaf Jah I, founder of the Hyderabad state and the last great Mughal statesman, dies at Burhanpur. The contest for his throne between his son Nasir Jung and grandson Muzaffar Jung draws in the French and British and sparks the Second Carnatic War.' },

  { d: '1749-08-03', p: 'ambur', ty: 'battle', f: ['french', 'hyderabad'], title: 'Battle of Ambur',
    sum: 'Dupleix backs Chanda Sahib for Arcot and Muzaffar Jung for Hyderabad. Their army, stiffened by French troops, kills the old Nawab Anwaruddin at Ambur. His son Muhammad Ali flees to Trichinopoly and appeals to the English.',
    forces: [{ f: 'french', who: "d'Auteuil, Chanda Sahib & Muzaffar Jung", n: 40000, label: 'c. 40,000 (est.)', detail: 'including c. 400 French and 2,000 French-trained sepoys' }, { f: 'other', who: 'Anwaruddin Khan', n: 20000, label: 'c. 20,000 (est.)' }],
    moves: [{ f: 'french', path: ['pondicherry', 'gingee', 'ambur'], kind: 'march', label: "d'Auteuil", unit: 'sepoy' }] },

  { d: '1750-12-16', p: 'gingee', ty: 'battle', f: ['hyderabad', 'french'], title: 'Nasir Jung killed',
    sum: 'Nasir Jung, the Nizam, is shot by one of his own Pathan nobles during a French attack near Gingee. Muzaffar Jung is proclaimed Nizam at Pondicherry, and Dupleix is named governor of the Mughal lands south of the Krishna. French influence spans half the Deccan.' },

  { d: '1751-02-13', p: 'hyderabad', ty: 'march', f: ['french', 'hyderabad'], title: "Bussy's march to Hyderabad",
    sum: 'Muzaffar Jung is killed in an ambush within weeks. Bussy, Dupleix\'s ablest officer, installs Salabat Jung in his place. For seven years a French corps garrisons the Nizam\'s court, the first European subsidiary force in India and a model the Company will later copy.',
    forces: [{ f: 'french', who: 'Charles de Bussy', n: 2300, label: 'c. 2,300', detail: 'about 300 Europeans and 2,000 sepoys' }],
    moves: [{ f: 'french', path: ['pondicherry', 'arcot', [78.8, 14.8], 'hyderabad'], kind: 'march', label: 'Bussy', unit: 'sepoy' }] },

  { d: '1751-05-15', p: 'cuttack', ty: 'treaty', f: ['bengal', 'maratha'], title: 'Orissa ceded to the Marathas',
    sum: 'Exhausted by a decade of raids, Alivardi Khan makes peace with Raghuji Bhonsle. Orissa passes under Maratha control and Bengal pays Rs 12 lakh a year in chauth.' },

  { d: '1751-09-01', p: 'arcot', ty: 'siege', f: ['eic', 'french'], pv: true, title: 'The Siege of Arcot',
    sum: 'To relieve Muhammad Ali in Trichinopoly, a 25-year-old former clerk named Robert Clive seizes Chanda Sahib\'s capital, Arcot. He then holds its crumbling fort for fifty days against Raza Sahib\'s army and its French contingent.',
    out: 'Chanda Sahib\'s cause starts to collapse, and the defence makes Clive\'s name.',
    lead: [['Robert Clive', 'Captain', 'eic'], ['Raza Sahib', "Chanda Sahib's son", 'french'], ['Muhammad Ali Walajah', 'Company-backed claimant to Arcot', 'other']],
    forces: [{ f: 'eic', who: 'Robert Clive', n: 500, label: 'c. 500', detail: 'about 200 Europeans, 300 sepoys, 3 guns' }, { f: 'french', who: 'Raza Sahib & French troops', n: 10000, label: 'c. 10,000 (est.)' }],
    moves: [{ f: 'eic', path: ['madras', [79.85, 13.0], 'arcot'], kind: 'march', label: 'Clive', unit: 'sepoy' }] },

  { d: '1752-06-13', p: 'trichinopoly', ty: 'siege', f: ['eic', 'french'], title: 'French surrender at Srirangam',
    sum: 'Stringer Lawrence and Clive trap Jacques Law\'s French force on the island of Srirangam, which surrenders. Chanda Sahib gives himself up to the Tanjore commander and is beheaded. Muhammad Ali, the Company\'s client, becomes Nawab of Arcot.',
    lead: [['Stringer Lawrence', 'Company commander', 'eic'], ['Robert Clive', 'Captain', 'eic'], ['Jacques Law', 'French commander', 'french'], ['Muhammad Ali Walajah', 'Nawab of Arcot', 'other']],
    moves: [{ f: 'eic', path: ['cuddalore', [79.2, 11.3], 'trichinopoly'], kind: 'march', label: 'Lawrence & Clive', unit: 'sepoy' }] },

  { d: '1753-12-01', p: 'masulipatam', ty: 'treaty', f: ['french', 'hyderabad'], title: 'The Northern Circars go to the French',
    sum: 'To pay Bussy\'s troops, Salabat Jung assigns the French the revenues of the Northern Circars, a rich coastal strip from Masulipatam to Ganjam. For a time France holds more Indian territory than the English Company.' },

  { d: '1754-06-02', p: 'delhi', ty: 'political', f: ['mughal', 'maratha'], title: 'Emperor blinded; Alamgir II enthroned',
    sum: 'The young wazir Imad-ul-Mulk, backed by Maratha troops under Malhar Rao Holkar, deposes and blinds Emperor Ahmad Shah Bahadur and enthrones the elderly Alamgir II. The emperor is now a pawn of whoever controls Delhi.' },

  { d: '1754-08-01', p: 'pondicherry', ty: 'political', f: ['french'], title: 'Dupleix recalled',
    sum: 'Alarmed at the cost of his wars, the directors of the Compagnie des Indes recall Dupleix. His successor Godeheu agrees a truce with the English that abandons most of his gains, though Bussy stays on at Hyderabad.' },

  { d: '1756-04-10', p: 'murshidabad', ty: 'political', f: ['bengal'], title: 'Siraj-ud-Daula becomes Nawab',
    sum: 'Alivardi Khan dies and is succeeded by his grandson Siraj-ud-Daula, then in his early twenties. Siraj alienates the Jagat Seth bankers and senior commanders such as Mir Jafar, and is enraged when the English fortify Calcutta without permission.',
    lead: [['Siraj-ud-Daula', 'Nawab of Bengal', 'bengal'], ['Mir Jafar', 'paymaster and commander', 'bengal'], ['Jagat Seth Mahtab Rai', 'banker', 'bengal'], ['Roger Drake', 'Governor of Calcutta', 'eic']] },

  { d: '1756-06-20', p: 'calcutta', ty: 'siege', f: ['bengal', 'eic'], pv: true, title: 'The Fall of Calcutta',
    sum: 'Siraj\'s army takes Fort William after Governor Drake and many officials flee downriver. That night prisoners are locked in the fort\'s punishment cell, the "Black Hole". The survivor J. Z. Holwell later claimed 123 of 146 died; modern historians think the true numbers were much smaller. The story becomes a rallying cry for revenge.',
    forces: [{ f: 'bengal', who: 'Siraj-ud-Daula', n: 50000, label: 'c. 30,000–50,000 (est.)' }, { f: 'eic', who: 'Roger Drake, then J. Z. Holwell', n: 515, label: 'c. 515 defenders' }],
    moves: [{ f: 'bengal', path: ['murshidabad', 'plassey', 'katwa', 'calcutta'], kind: 'march', label: 'Siraj-ud-Daula', unit: 'army' }] },

  { d: '1756-10-16', p: 'madras', ty: 'naval', f: ['eic'], title: 'Clive and Watson sail for Bengal',
    sum: 'Madras sends its best troops north under Clive, carried by Admiral Charles Watson\'s squadron. After a stormy voyage up the Bay of Bengal, the fleet reaches the Hooghly in December.',
    forces: [{ f: 'eic', who: 'Clive & Admiral Watson', n: 2400, label: 'c. 2,400', detail: 'about 900 Europeans and 1,500 sepoys' }],
    moves: [{ f: 'eic', path: ['madras', [81.6, 14.8], [84.6, 17.4], [87.4, 20.1], [88.1, 21.6], 'calcutta'], kind: 'naval', label: 'Watson & Clive', unit: 'warship' }] },

  { d: '1757-01-02', p: 'calcutta', ty: 'siege', f: ['eic', 'bengal'], title: 'Calcutta retaken',
    sum: 'Watson\'s ships and Clive\'s troops retake Fort William with little resistance, then sack the Mughal port of Hughli. After a confused dawn attack on Siraj\'s camp in February, the Nawab signs the Treaty of Alinagar restoring the Company\'s privileges.' },

  { d: '1757-01-28', p: 'delhi', ty: 'sack', f: ['afghan', 'mughal'], title: 'Ahmad Shah Durrani sacks Delhi',
    sum: 'On his fourth invasion Ahmad Shah Durrani occupies Delhi for a month, extorting its nobles, then massacres pilgrims at the holy cities of Mathura and Vrindavan. He leaves the Rohilla chief Najib-ud-Daula as his agent in Delhi.',
    moves: [{ f: 'afghan', path: ['kandahar', 'lahore', 'delhi', 'mathura'], kind: 'march', label: 'Ahmad Shah Durrani', unit: 'heavy' }] },

  { d: '1757-03-23', p: 'chandernagore', ty: 'siege', f: ['eic', 'french'], title: 'Capture of Chandernagore',
    sum: 'News arrives of the Seven Years\' War. Clive and Watson attack the French settlement of Chandernagore; Watson\'s ships batter Fort d\'Orléans into surrender. Siraj, who had protected the French, is humiliated.',
    moves: [{ f: 'eic', path: ['calcutta', 'chandernagore'], kind: 'naval', label: 'Watson', unit: 'warship' }] },

  { d: '1757-06-04', p: 'murshidabad', ty: 'political', f: ['eic', 'bengal'], title: 'The conspiracy against Siraj',
    sum: 'The Company\'s agent William Watts secretly signs a treaty with Mir Jafar, Siraj\'s own commander, promising him the throne in return for vast payments. The Jagat Seths, who underwrite the plot, want Siraj gone. Clive has a fake treaty drawn up to cheat the go-between Omichund of his share.',
    lead: [['Mir Jafar', 'commander and conspirator', 'bengal'], ['Jagat Seth Mahtab Rai', 'banker', 'bengal'], ['William Watts', 'Company agent', 'eic'], ['Omichund', 'merchant go-between', 'other']] },

  { d: '1757-06-23', p: 'plassey', ty: 'battle', f: ['eic', 'bengal', 'french'], pv: true, title: 'Battle of Plassey',
    sum: 'In a mango grove by the Bhagirathi, Clive\'s small army faces Siraj-ud-Daula. A monsoon downpour soaks the Nawab\'s powder while the British keep theirs dry under tarpaulins, and Mir Jafar\'s divisions stand aside. When Siraj\'s loyal commander Mir Madan is killed, the Nawab flees. The fighting lasts less than a day.',
    out: 'About 22 British dead. Mir Jafar becomes Nawab, and the Company becomes the real power in Bengal.',
    lead: [['Robert Clive', 'Company commander', 'eic'], ['Siraj-ud-Daula', 'Nawab of Bengal', 'bengal'], ['Mir Jafar', 'stood aside', 'bengal'], ['Mir Madan', 'loyal commander, killed', 'bengal']],
    forces: [{ f: 'eic', who: 'Robert Clive', n: 3000, label: 'c. 3,000', detail: 'about 900 Europeans, 2,100 sepoys, 10 guns' }, { f: 'bengal', who: 'Siraj-ud-Daula', n: 50000, label: 'c. 50,000', detail: "including Mir Jafar's idle divisions; c. 50 French gunners under St Frais" }],
    moves: [{ f: 'eic', path: ['calcutta', 'chandernagore', 'katwa', 'plassey'], kind: 'march', label: 'Clive', unit: 'sepoy' }, { f: 'bengal', path: ['murshidabad', 'plassey'], kind: 'march', label: 'Siraj-ud-Daula', unit: 'army' }] },

  { d: '1757-07-02', p: 'murshidabad', ty: 'massacre', f: ['bengal', 'eic'], title: 'Death of Siraj-ud-Daula',
    sum: 'Captured while fleeing, Siraj is brought back to Murshidabad and stabbed to death on the orders of Mir Jafar\'s son Miran. Mir Jafar pays the Company and its officers enormous sums. Clive himself receives over £200,000, an almost unimaginable fortune.' },

  { d: '1757-07-06', p: 'calcutta', ty: 'trade', f: ['eic', 'bengal'], title: 'The treasure boats',
    sum: 'Mir Jafar starts paying for his throne. The first instalment of the Company\'s reward, coined silver packed in chests, is sent down the river from Murshidabad to Calcutta in a large flotilla of boats. For years afterwards the plunder of Plassey flows to the Company and its servants, and silver drains out of Bengal.',
    moves: [{ f: 'eic', path: ['murshidabad', 'plassey', 'katwa', [88.42, 23.2], 'chandernagore', 'calcutta'], kind: 'river', unit: 'treasure', label: 'Treasure flotilla' }] },

  { d: '1758-04-20', p: 'lahore', ty: 'march', f: ['maratha', 'afghan'], title: 'Marathas reach Lahore and Attock',
    sum: 'Raghunathrao and Malhar Rao Holkar drive the Afghans out of the Punjab and take Lahore; Maratha outposts reach Attock on the Indus. It is the high-water mark of Maratha expansion and a direct challenge to Ahmad Shah Durrani.',
    moves: [{ f: 'maratha', path: ['delhi', 'sirhind', 'lahore', [72.25, 33.9]], kind: 'march', label: 'Raghunathrao', unit: 'cavalry' }] },

  { d: '1758-06-02', p: 'cuddalore', ty: 'siege', f: ['french', 'eic'], title: "Lally's offensive",
    sum: 'The Comte de Lally lands with French reinforcements and takes Fort St David. He besieges Madras from December 1758 but abandons the siege when a British fleet arrives in February 1759. He also recalls Bussy from Hyderabad, throwing away France\'s influence in the Deccan.',
    moves: [{ f: 'french', path: ['pondicherry', 'cuddalore'], kind: 'march', label: 'Lally', unit: 'sepoy' }, { f: 'french', path: ['pondicherry', [80.0, 12.4], 'madras'], kind: 'march', label: 'Siege of Madras', unit: 'artillery' }] },

  { d: '1759-04-05', p: 'patna', ty: 'siege', f: ['mughal', 'eic'], title: 'Prince Ali Gauhar invades Bihar',
    sum: 'The Mughal crown prince Ali Gauhar, fleeing his father\'s murderous wazir, invades Bihar and besieges Patna. Clive marches up from Murshidabad and the prince retreats, beginning years of wandering in the eastern provinces.',
    moves: [{ f: 'mughal', path: ['allahabad', 'benares', 'patna'], kind: 'march', label: 'Ali Gauhar', unit: 'royal' }, { f: 'eic', path: ['murshidabad', [87.0, 25.2], 'patna'], kind: 'march', label: 'Clive', unit: 'sepoy' }] },

  { d: '1759-04-08', p: 'masulipatam', ty: 'siege', f: ['eic', 'french'], title: 'Forde storms Masulipatam',
    sum: 'Clive sends Colonel Francis Forde from Bengal to the Northern Circars. Forde defeats the French at Condore and storms Masulipatam by night, and Salabat Jung switches his favour to the English.',
    moves: [{ f: 'eic', path: ['calcutta', [87.9, 21.0], [86.6, 19.6], [84.4, 18.3], [83.0, 17.3], 'masulipatam'], kind: 'naval', label: 'Forde', unit: 'warship' }] },

  { d: '1759-12-24', p: [84.6, 25.25], pname: "Shah Alam's camp, Bihar", ty: 'political', f: ['mughal'], title: 'Shah Alam II proclaimed',
    sum: 'In Delhi, Imad-ul-Mulk has the old emperor Alamgir II murdered on 29 November. When the news reaches Ali Gauhar in Bihar, he proclaims himself Emperor Shah Alam II. For twelve years he will be an emperor without a capital.',
    lead: [['Shah Alam II', 'Mughal Emperor, in exile', 'mughal'], ['Imad-ul-Mulk', 'Wazir', 'mughal']] },

  { d: '1760-01-22', p: 'wandiwash', ty: 'battle', f: ['eic', 'french'], title: 'Battle of Wandiwash',
    sum: 'Eyre Coote decisively defeats Lally at Wandiwash, and Bussy is taken prisoner. French power in the Carnatic is broken and Pondicherry is soon under siege.',
    forces: [{ f: 'eic', who: 'Eyre Coote', n: 5300, label: 'c. 5,300', detail: 'about 1,900 Europeans, 2,100 sepoys, 1,250 cavalry' }, { f: 'french', who: 'Comte de Lally', n: 4500, label: 'c. 4,500', detail: 'about 2,250 Europeans and 1,300 sepoys, with allies' }],
    moves: [{ f: 'eic', path: ['madras', [79.9, 12.8], 'wandiwash'], kind: 'march', label: 'Coote', unit: 'sepoy' }] },

  { d: '1760-10-20', p: 'murshidabad', ty: 'political', f: ['eic', 'bengal'], title: 'Mir Qasim replaces Mir Jafar',
    sum: 'Governor Vansittart deposes the debt-ridden Mir Jafar in favour of his capable son-in-law Mir Qasim, who pays for the favour by ceding Burdwan, Midnapore and Chittagong. Mir Qasim moves his capital to Monghyr and begins building a modern army.',
    lead: [['Mir Qasim', 'new Nawab', 'bengal'], ['Henry Vansittart', 'Governor of Bengal', 'eic']] },

  { d: '1761-01-14', p: 'panipat', ty: 'battle', f: ['maratha', 'afghan', 'awadh'], pv: true, title: 'Third Battle of Panipat',
    sum: 'Trapped for weeks and starving in its fortified camp, the Maratha army of Sadashivrao Bhau breaks out against Ahmad Shah Durrani and his Indian allies, the Rohilla Najib-ud-Daula and Shuja-ud-Daula of Awadh. After hours of slaughter the Maratha line collapses. The Bhau and the Peshwa\'s heir Vishwasrao are killed, and tens of thousands of soldiers and camp followers are cut down in the pursuit.',
    out: 'One of the largest battles of the century. Maratha expansion in the north halts for a decade, leaving a vacuum the Company will fill.',
    lead: [['Ahmad Shah Durrani', 'King of the Afghans', 'afghan'], ['Sadashivrao Bhau', 'Maratha commander, killed', 'maratha'], ['Vishwasrao', "Peshwa's heir, killed", 'maratha'], ['Ibrahim Khan Gardi', 'commander of trained infantry', 'maratha'], ['Shuja-ud-Daula', 'Nawab of Awadh', 'awadh']],
    forces: [{ f: 'afghan', who: 'Ahmad Shah Durrani', n: 80000, label: 'c. 80,000', detail: 'about 42,000 Afghan cavalry plus Rohilla and Awadh allies' }, { f: 'maratha', who: 'Sadashivrao Bhau', n: 55000, label: 'c. 45,000–60,000', detail: "including Ibrahim Khan Gardi's trained infantry; perhaps 200,000 non-combatants in camp" }],
    moves: [{ f: 'maratha', path: ['poona', 'indore', 'gwalior', 'delhi', 'panipat'], kind: 'march', label: 'Sadashivrao Bhau', unit: 'army' }, { f: 'afghan', path: ['kandahar', 'lahore', [77.6, 29.6], 'panipat'], kind: 'march', label: 'Ahmad Shah Durrani', unit: 'heavy' }] },

  { d: '1761-01-16', p: 'pondicherry', ty: 'siege', f: ['eic', 'french'], title: 'Fall of Pondicherry',
    sum: 'Starved by blockade on land and sea, Lally surrenders Pondicherry to Coote\'s army and the British raze its fortifications. The French company will never again contend seriously for India. Lally is later beheaded in Paris.',
    moves: [{ f: 'eic', path: ['wandiwash', 'pondicherry'], kind: 'march', label: 'Coote', unit: 'artillery' }] },

  { d: '1761-06-23', p: 'poona', ty: 'political', f: ['maratha'], title: 'Peshwa Balaji Bajirao dies',
    sum: 'Broken by the news of Panipat, the Peshwa dies. His 16-year-old son Madhavrao I proves a remarkable ruler, restoring Maratha power in the 1760s despite the scheming of his uncle Raghunathrao.' },

  { d: '1761-06-30', p: 'seringapatam', ty: 'political', f: ['mysore'], title: 'Hyder Ali takes power in Mysore',
    sum: 'Hyder Ali, a cavalry officer of modest origins who studied French methods in the Carnatic wars, sidelines the Wodeyar king\'s ministers and becomes the de facto ruler of Mysore. He will build one of the most formidable armies in India.',
    lead: [['Hyder Ali', 'de facto ruler of Mysore', 'mysore']] },

  { d: '1763-09-05', p: 'udhuanala', ty: 'battle', f: ['eic', 'bengal'], title: 'War with Mir Qasim',
    sum: 'Mir Qasim tries to stop Company servants abusing their duty-free trading privileges, and war follows. Major Thomas Adams defeats his modernised army at Katwa, Giria and finally the entrenched line of Udhua Nala. Mir Qasim flees west and Mir Jafar is restored.',
    forces: [{ f: 'eic', who: 'Major Thomas Adams', n: 3000, label: 'c. 3,000 (est.)' }, { f: 'bengal', who: 'Mir Qasim', n: 40000, label: 'c. 40,000 (est.)', detail: 'commanders Gurgin Khan and Walter Reinhardt' }],
    moves: [{ f: 'eic', path: ['calcutta', 'katwa', 'murshidabad', 'udhuanala'], kind: 'march', label: 'Adams', unit: 'sepoy' }, { f: 'bengal', path: ['udhuanala', [86.5, 25.4], 'patna'], kind: 'retreat', label: 'Mir Qasim', unit: 'infantry' }] },

  { d: '1763-10-06', p: 'patna', ty: 'massacre', f: ['bengal', 'eic'], title: 'The Patna massacre',
    sum: 'As his cause collapses, Mir Qasim orders the execution of the Company prisoners held at Patna. The European mercenary Walter Reinhardt, known as Sumroo, carries it out; around 45 Company men, including the Patna chief William Ellis, are killed. The Jagat Seth bankers are also put to death.' },

  { d: '1764-10-22', p: 'buxar', ty: 'battle', f: ['eic', 'awadh', 'mughal', 'bengal'], pv: true, title: 'Battle of Buxar',
    sum: 'Mir Qasim, Shuja-ud-Daula of Awadh and Emperor Shah Alam II join forces to drive the Company out of Bihar. Major Hector Munro meets them at Buxar on the Ganges. After about three hours of hard fighting the allied army breaks. Shah Alam, who kept his own troops largely out of the battle, soon comes over to the British camp.',
    out: 'More decisive than Plassey: the Company is now the strongest military power in eastern India.',
    lead: [['Hector Munro', 'Company commander', 'eic'], ['Shuja-ud-Daula', 'Nawab of Awadh', 'awadh'], ['Shah Alam II', 'Mughal Emperor', 'mughal'], ['Mir Qasim', 'deposed Nawab of Bengal', 'bengal']],
    forces: [{ f: 'eic', who: 'Major Hector Munro', n: 7072, label: '7,072', detail: '857 Europeans, 5,297 sepoys, 918 Indian cavalry' }, { f: 'awadh', who: 'Shuja-ud-Daula, Mir Qasim & Shah Alam', n: 40000, label: 'c. 40,000 (est.)' }],
    moves: [{ f: 'eic', path: ['patna', [84.6, 25.45], 'buxar'], kind: 'march', label: 'Munro', unit: 'sepoy' }, { f: 'awadh', path: ['lucknow', 'benares', 'buxar'], kind: 'march', label: 'Shuja-ud-Daula', unit: 'heavy' }, { f: 'mughal', path: ['allahabad', 'benares', [83.65, 25.48]], kind: 'march', label: 'Shah Alam', unit: 'royal' }] },

  { d: '1765-05-03', p: 'jajmau', ty: 'battle', f: ['eic', 'awadh', 'maratha'], title: 'Battle of Kora',
    sum: 'General John Carnac defeats Shuja-ud-Daula, now allied with the Maratha veteran Malhar Rao Holkar, near Kora. Shuja surrenders himself to the British.',
    moves: [{ f: 'eic', path: ['allahabad', 'jajmau'], kind: 'march', label: 'Carnac', unit: 'sepoy' }] },

  { d: '1765-08-12', p: 'allahabad', ty: 'treaty', f: ['eic', 'mughal', 'awadh'], pv: true, title: 'Treaty of Allahabad: the Diwani',
    sum: 'Clive, back in India, meets Shah Alam at Allahabad. The emperor grants the Company the Diwani, the right to collect the revenues of Bengal, Bihar and Orissa, in return for an annual tribute of Rs 26 lakh and the districts of Kora and Allahabad. The ceremony is improvised, with Clive\'s dining table serving as a throne. Shuja-ud-Daula gets Awadh back for an indemnity of Rs 50 lakh.',
    out: 'A trading corporation becomes the tax collector and effective ruler of tens of millions of people.',
    lead: [['Robert Clive', 'Governor of Bengal', 'eic'], ['Shah Alam II', 'Mughal Emperor', 'mughal'], ['Shuja-ud-Daula', 'Nawab of Awadh', 'awadh']],
    moves: [{ f: 'eic', path: ['calcutta', 'murshidabad', 'patna', 'benares', 'allahabad'], kind: 'march', label: 'Clive', unit: 'sepoy' }] },

  { d: '1766-03-01', p: 'calcutta', ty: 'trade', f: ['eic'], title: 'Bengal pays for its own exports',
    sum: 'With the Diwani, the Company stops shipping silver to India to buy Bengal\'s cloth. Its annual "investment" of cottons and silks for London is now bought with Bengal\'s own land revenue. In effect the province pays for the goods taken from it.',
    moves: [{ f: 'eic', path: ['dhaka', [90.0, 22.7], [89.1, 22.1], 'calcutta'], kind: 'river', unit: 'caravan', label: 'Muslins from Dhaka' }, { f: 'eic', path: ['calcutta', [88.1, 21.4], [87.0, 18.6], [85.0, 13.5], [82.6, 8.0], [79.5, 5.2]], kind: 'naval', unit: 'merchant', label: 'East Indiamen for London' }] },

  { d: '1766-11-12', p: 'masulipatam', ty: 'treaty', f: ['eic', 'hyderabad'], title: 'The Northern Circars secured',
    sum: 'By treaty with Nizam Ali Khan, Madras secures the Northern Circars, already granted by Shah Alam in 1765, linking Madras with Bengal along the coast in return for promised military aid.' },

  { d: '1767-09-26', p: 'tiruvannamalai', ty: 'battle', f: ['mysore', 'hyderabad', 'eic'], title: 'First Anglo-Mysore War',
    sum: 'Hyder Ali and the Nizam invade the Carnatic. Colonel Joseph Smith beats them at Changama and Tiruvannamalai and the Nizam changes sides, but Hyder\'s fast cavalry keeps the war alive across the plains.',
    moves: [{ f: 'mysore', path: ['seringapatam', 'bangalore', [78.6, 12.5], 'tiruvannamalai'], kind: 'march', label: 'Hyder Ali', unit: 'cavalry' }] },

  { d: '1769-04-04', p: 'madras', ty: 'treaty', f: ['mysore', 'eic'], title: 'Hyder Ali at the gates of Madras',
    sum: 'Slipping past the Company army, Hyder rides about 120 miles in three and a half days with 6,000 cavalry and appears within five miles of Madras. The alarmed council signs the Treaty of Madras: mutual return of conquests and a defensive alliance the British will not honour.',
    forces: [{ f: 'mysore', who: 'Hyder Ali', n: 6000, label: 'c. 6,000 cavalry' }],
    moves: [{ f: 'mysore', path: ['bangalore', [79.0, 12.7], 'madras'], kind: 'march', label: 'Hyder Ali', unit: 'cavalry' }] },

  { d: '1770-06-01', p: [88.6, 23.9], pname: 'Bengal & Bihar', ty: 'famine', f: ['eic', 'bengal'], pv: true, title: 'The Great Bengal Famine',
    sum: 'After the rains fail in 1769, famine sweeps Bengal and Bihar. The Company\'s revenue collectors keep demanding taxes, and some of its servants corner the grain trade. Estimates of the dead range from about 1.2 million to as many as 10 million, perhaps a fifth to a third of the population.',
    out: 'Revenue collection barely falls. The scandal helps turn British opinion against the Company.' },

  { d: '1772-01-06', p: 'delhi', ty: 'march', f: ['mughal', 'maratha'], pv: true, title: 'The Emperor returns to Delhi',
    sum: 'Tired of life as a British pensioner in Allahabad, Shah Alam marches for his capital under the protection of a Maratha army led by Mahadji Scindia, and re-enters the Red Fort after twelve years of exile. The British stop paying his tribute. Delhi becomes a Maratha protectorate.',
    out: 'Shah Alam chooses the Marathas over the Company. The Mughal throne becomes a Maratha asset.',
    lead: [['Shah Alam II', 'Mughal Emperor', 'mughal'], ['Mahadji Scindia', 'Maratha chief', 'maratha'], ['Mirza Najaf Khan', 'Mughal general', 'mughal']],
    moves: [{ f: 'mughal', path: ['allahabad', 'kanpur', [79.6, 27.3], 'aligarh', 'delhi'], kind: 'march', label: 'Shah Alam II', unit: 'royal' }, { f: 'maratha', path: ['gwalior', 'agra', 'mathura', 'delhi'], kind: 'march', label: 'Mahadji Scindia', unit: 'cavalry' }] },

  { d: '1772-04-13', p: 'calcutta', ty: 'policy', f: ['eic'], title: 'Warren Hastings takes charge',
    sum: 'Warren Hastings becomes Governor of Bengal. The Company ends the dual system, moves the treasury from Murshidabad to Calcutta and begins to govern directly. The Regulating Act of 1773 makes him the first Governor-General in 1774, under a hostile council led by Philip Francis.',
    lead: [['Warren Hastings', 'Governor of Bengal', 'eic'], ['Philip Francis', 'councillor and rival', 'eic']] },

  { d: '1773-08-30', p: 'poona', ty: 'massacre', f: ['maratha'], title: 'Murder of Peshwa Narayanrao',
    sum: 'Peshwa Madhavrao I died of tuberculosis in 1772. His young brother Narayanrao is murdered by palace guards, and his uncle Raghunathrao is widely blamed. Nana Phadnavis and a council of ministers rally behind Narayanrao\'s posthumous son, Madhavrao II. Raghunathrao turns to the British.',
    lead: [['Raghunathrao', 'claimant', 'maratha'], ['Nana Phadnavis', 'minister', 'maratha']] },

  { d: '1773-09-07', p: 'benares', ty: 'treaty', f: ['eic', 'awadh', 'mughal'], title: 'Treaty of Benares',
    sum: 'Hastings sells Kora and Allahabad, granted to Shah Alam in 1765, to Shuja-ud-Daula for Rs 50 lakh, and stops the emperor\'s tribute. He also agrees to hire out a Company brigade to Shuja to conquer the Rohillas.' },

  { d: '1773-11-01', p: 'patna', ty: 'trade', f: ['eic'], title: 'The opium monopoly',
    sum: 'Hastings makes the growing and sale of Bihar opium a Company monopoly. The drug is auctioned at Calcutta and smuggled to China by private "country" traders, whose silver pays for the tea that has become the Company\'s most valuable cargo in London.',
    moves: [{ f: 'eic', path: ['patna', 'udhuanala', 'murshidabad', [88.42, 23.2], 'calcutta'], kind: 'river', unit: 'caravan', label: 'Bihar opium' }, { f: 'eic', path: ['calcutta', [88.2, 21.4], [90.8, 18.4], [93.6, 15.2], [97.4, 12.8]], kind: 'naval', unit: 'merchant', label: 'Country ships to Canton' }] },

  { d: '1774-04-23', p: 'katra', ty: 'battle', f: ['eic', 'awadh'], title: 'The Rohilla War',
    sum: 'Colonel Champion\'s Company brigade, hired out to Shuja-ud-Daula, defeats the Rohilla Afghans at Miranpur Katra, and their leader Hafiz Rahmat Khan is killed. The plundering of Rohilkhand becomes one of the charges at Hastings\'s impeachment.',
    moves: [{ f: 'eic', path: ['lucknow', [79.9, 27.5], 'katra'], kind: 'march', label: 'Champion', unit: 'sepoy' }] },

  { d: '1775-03-06', p: 'surat', ty: 'treaty', f: ['eic', 'maratha'], title: 'Treaty of Surat',
    sum: 'The Bombay government agrees to restore Raghunathrao as Peshwa in exchange for Salsette and Bassein. Calcutta denounces the deal, but the First Anglo-Maratha War has begun.' },

  { d: '1779-01-16', p: 'wadgaon', ty: 'battle', f: ['eic', 'maratha'], pv: true, title: 'Convention of Wadgaon',
    sum: 'A Bombay army escorting Raghunathrao climbs the Western Ghats toward Poona, is surrounded near Talegaon by Maratha forces under Mahadji Scindia and Nana Phadnavis, and retreats. At Wadgaon its commanders sign a humiliating convention giving up all recent conquests. Calcutta repudiates it.',
    out: 'One of the Company\'s worst humiliations: the Marathas are still a match for it.',
    forces: [{ f: 'eic', who: 'Colonel Egerton & John Carnac', n: 3900, label: 'c. 3,900' }, { f: 'maratha', who: 'Mahadji Scindia & Nana Phadnavis', n: 50000, label: 'c. 50,000 (est.)' }],
    moves: [{ f: 'eic', path: ['bombay', [73.3, 18.75], 'wadgaon'], kind: 'march', label: 'Bombay army', unit: 'sepoy' }, { f: 'maratha', path: ['poona', 'wadgaon'], kind: 'march', label: 'Mahadji Scindia', unit: 'cavalry' }] },

  { d: '1779-02-26', p: 'surat', ty: 'march', f: ['eic'], title: "Goddard's march across India",
    sum: 'Hastings\'s answer is already on the road: a Bengal army under Thomas Goddard that marches right across central India, through Maratha and Bundela country, to reach Surat on the west coast. Contemporaries marvel at the logistics.',
    forces: [{ f: 'eic', who: 'Thomas Goddard', n: 6000, label: 'c. 6,000 (est.)' }],
    moves: [{ f: 'eic', path: ['kalpi', [78.6, 24.6], 'bhopal', 'burhanpur', [74.3, 21.3], 'surat'], kind: 'march', label: 'Goddard', unit: 'sepoy' }] },

  { d: '1780-07-20', p: 'arcot', ty: 'march', f: ['mysore', 'eic'], title: 'Hyder Ali invades the Carnatic',
    sum: 'Allied with the Marathas and the Nizam against the Company, Hyder Ali pours through the passes into the Carnatic with a huge army, burning villages up to the outskirts of Madras.',
    forces: [{ f: 'mysore', who: 'Hyder Ali & Tipu Sultan', n: 80000, label: 'c. 80,000 (est.)', detail: 'with about 100 guns' }],
    moves: [{ f: 'mysore', path: ['seringapatam', 'bangalore', [78.5, 12.6], 'arcot'], kind: 'march', label: 'Hyder Ali', unit: 'army' }] },

  { d: '1780-08-03', p: 'gwalior', ty: 'siege', f: ['eic', 'maratha'], title: 'Popham storms Gwalior',
    sum: 'Captain William Popham\'s men scale the cliffs of Gwalior, Mahadji Scindia\'s supposedly impregnable fortress, at night with rope ladders. The coup restores some British prestige in the north.' },

  { d: '1780-09-10', p: 'pollilur', ty: 'battle', f: ['mysore', 'eic'], pv: true, title: 'Battle of Pollilur',
    sum: 'Colonel William Baillie\'s column, marching to join Sir Hector Munro, is cut off by Tipu Sultan and then overwhelmed by Hyder\'s main army after its ammunition carts explode. It is the worst defeat the Company has yet suffered in India. Baillie and some 200 Europeans are marched to the dungeons of Seringapatam; Tipu later has the battle painted on the walls of his summer palace.',
    out: 'For a moment it seems the British might be driven out of the south altogether.',
    lead: [['Tipu Sultan', 'Mysore commander', 'mysore'], ['Hyder Ali', 'ruler of Mysore', 'mysore'], ['William Baillie', 'Company colonel, captured', 'eic'], ['Sir Hector Munro', 'Company commander', 'eic']],
    forces: [{ f: 'eic', who: 'Colonel William Baillie', n: 3800, label: 'c. 3,800' }, { f: 'mysore', who: 'Tipu Sultan & Hyder Ali', n: 40000, label: 'c. 30,000–50,000 (est.)' }],
    moves: [{ f: 'eic', path: [[79.95, 13.9], [79.8, 13.3], 'pollilur'], kind: 'march', label: 'Baillie', unit: 'sepoy' }, { f: 'mysore', path: ['arcot', 'pollilur'], kind: 'march', label: 'Tipu Sultan', unit: 'cavalry' }] },

  { d: '1781-07-01', p: 'portonovo', ty: 'battle', f: ['eic', 'mysore'], title: 'Battle of Porto Novo',
    sum: 'Sir Eyre Coote, old and ill, comes from Bengal to save Madras. At Porto Novo his outnumbered army defeats Hyder Ali and turns the tide in the Carnatic.',
    forces: [{ f: 'eic', who: 'Sir Eyre Coote', n: 8000, label: 'c. 8,000' }, { f: 'mysore', who: 'Hyder Ali', n: 40000, label: 'c. 40,000+ (est.)' }],
    moves: [{ f: 'eic', path: ['cuddalore', 'portonovo'], kind: 'march', label: 'Coote', unit: 'sepoy' }] },

  { d: '1781-08-16', p: 'benares', ty: 'battle', f: ['eic'], title: "Chait Singh's revolt",
    sum: 'Hastings arrives at Benares demanding huge sums from Raja Chait Singh and places him under arrest. The Raja\'s men kill the sepoys guarding him and Hastings has to escape to Chunar. The episode, and the later squeezing of the Begums of Awadh, feature prominently in his impeachment.' },

  { d: '1782-05-17', p: 'salbai', ty: 'treaty', f: ['eic', 'maratha'], title: 'Treaty of Salbai',
    sum: 'Mahadji Scindia brokers peace between the Company and the Peshwa\'s government. The British keep Salsette, abandon Raghunathrao and hand back their other conquests. Mahadji emerges as the most powerful man in northern India.' },

  { d: '1782-12-07', p: 'chittoor', ty: 'political', f: ['mysore'], title: 'Death of Hyder Ali',
    sum: 'Hyder Ali dies in camp near Chittoor. His son Tipu Sultan, educated, ambitious and implacably anti-British, succeeds him and continues the war.',
    lead: [['Tipu Sultan', 'new ruler of Mysore', 'mysore']] },

  { d: '1784-03-11', p: 'mangalore', ty: 'treaty', f: ['mysore', 'eic'], title: 'Treaty of Mangalore',
    sum: 'After a long siege of Mangalore, Tipu makes peace on the basis of mutual return of conquests. He treats the Company commissioners with calculated disdain, and the British regard the treaty as a humiliation.' },

  { d: '1784-12-01', p: 'delhi', ty: 'political', f: ['maratha', 'mughal'], title: 'Mahadji Scindia, Regent of the Empire',
    sum: 'Shah Alam appoints Mahadji Scindia Vakil-i-Mutlaq, regent and commander of the empire. With battalions trained by the Savoyard officer Benoît de Boigne, Mahadji is master of Delhi and Hindustan.' },

  { d: '1785-02-01', p: 'calcutta', ty: 'policy', f: ['eic'], title: 'Hastings leaves India',
    sum: 'Warren Hastings sails for England. Edmund Burke and Philip Francis pursue him, and in February 1788 his impeachment opens in Westminster Hall. The trial lasts seven years and ends in acquittal in 1795.' },

  { d: '1786-09-12', p: 'calcutta', ty: 'policy', f: ['eic'], title: 'Lord Cornwallis arrives',
    sum: 'Charles, Earl Cornwallis, the general who surrendered at Yorktown, arrives as Governor-General with powers strengthened by Pitt\'s India Act. He sets out to purge corruption and professionalise the Company\'s administration, while excluding Indians from senior posts.',
    lead: [['Charles, Earl Cornwallis', 'Governor-General', 'eic']] },

  { d: '1788-08-10', p: 'delhi', ty: 'massacre', f: ['mughal', 'maratha'], pv: true, title: 'The Blinding of Shah Alam',
    sum: 'While Mahadji Scindia is distracted in Rajputana, the young Rohilla chief Ghulam Qadir seizes the Red Fort. Searching for hidden treasure, he torments the royal family for weeks, and on 10 August blinds the elderly emperor himself. Maratha troops retake Delhi in October; Ghulam Qadir is caught and executed early in 1789.',
    out: 'The emperor survives, blind, as a symbol whose name still confers legitimacy.',
    lead: [['Shah Alam II', 'Mughal Emperor', 'mughal'], ['Ghulam Qadir', 'Rohilla chief', 'other'], ['Mahadji Scindia', 'Regent', 'maratha']],
    moves: [{ f: 'other', path: [[78.1, 29.9], 'delhi'], kind: 'march', label: 'Ghulam Qadir', unit: 'cavalry' }, { f: 'maratha', path: ['mathura', 'delhi'], kind: 'march', label: "Scindia's army", unit: 'sepoy' }] },

  { d: '1789-12-29', p: 'travlines', ty: 'battle', f: ['mysore', 'eic'], title: 'Tipu attacks the Travancore Lines',
    sum: 'Tipu attacks the defensive lines of the Raja of Travancore, a Company ally. Cornwallis treats it as an act of war, and the Third Anglo-Mysore War begins with the Marathas and the Nizam joining the British.',
    moves: [{ f: 'mysore', path: ['seringapatam', [76.9, 11.4], 'travlines'], kind: 'march', label: 'Tipu Sultan', unit: 'army' }] },

  { d: '1791-03-21', p: 'bangalore', ty: 'siege', f: ['eic', 'mysore'], title: 'Cornwallis storms Bangalore',
    sum: 'Taking command in person, Cornwallis marches up from the coast and storms Bangalore. His first advance on Seringapatam that May stalls when supplies and draught bullocks give out.',
    moves: [{ f: 'eic', path: ['madras', 'vellore', [78.4, 12.8], 'bangalore'], kind: 'march', label: 'Cornwallis', unit: 'artillery' }] },

  { d: '1792-03-18', p: 'seringapatam', ty: 'siege', f: ['eic', 'mysore', 'maratha', 'hyderabad'], title: 'Siege of Seringapatam; Mysore partitioned',
    sum: 'With Maratha and Nizam armies alongside, Cornwallis storms Tipu\'s lines outside Seringapatam. Tipu cedes half his kingdom: Malabar, Coorg, Dindigul and the Baramahal go to the Company, and the Marathas and the Nizam take lands to the north. He pays an indemnity of 3.3 crore rupees and hands over two young sons as hostages.',
    forces: [{ f: 'eic', who: 'Lord Cornwallis', n: 22000, label: 'c. 22,000 + allies (est.)' }, { f: 'mysore', who: 'Tipu Sultan', n: 45000, label: 'c. 45,000 (est.)' }],
    moves: [{ f: 'eic', path: ['bangalore', [77.2, 12.6], 'seringapatam'], kind: 'march', label: 'Cornwallis', unit: 'sepoy' }] },

  { d: '1793-03-22', p: 'calcutta', ty: 'policy', f: ['eic'], title: 'The Permanent Settlement',
    sum: 'Cornwallis fixes Bengal\'s land revenue in perpetuity, turning the zamindars into landlords on the English model. In the same year war with revolutionary France resumes and Pondicherry is seized once more.' },

  { d: '1794-02-12', p: 'poona', ty: 'political', f: ['maratha'], title: 'Death of Mahadji Scindia',
    sum: 'Mahadji Scindia dies near Poona. His teenage heir Daulat Rao Scindia inherits a formidable army officered by Europeans under Pierre Perron, and the Maratha chiefs begin to fall out.' },

  { d: '1795-03-11', p: 'kharda', ty: 'battle', f: ['maratha', 'hyderabad'], title: 'Battle of Kharda',
    sum: 'The Maratha chiefs, united for the last time under Nana Phadnavis, rout the Nizam\'s army at Kharda. Nizam Ali Khan cedes territory and pays tribute; the Company, bound by its own policy of non-intervention, stands aside.',
    moves: [{ f: 'maratha', path: ['poona', 'kharda'], kind: 'march', label: 'Maratha armies', unit: 'cavalry' }, { f: 'hyderabad', path: ['hyderabad', [76.6, 18.2], 'kharda'], kind: 'march', label: 'Nizam Ali Khan', unit: 'army' }] },

  { d: '1798-05-17', p: 'calcutta', ty: 'policy', f: ['eic', 'french'], title: 'Richard Wellesley arrives',
    sum: 'Richard Wellesley, Earl of Mornington, arrives as Governor-General determined to destroy French influence and make the Company paramount in India, by force if necessary. Napoleon\'s invasion of Egypt that summer makes the French threat seem very real.',
    lead: [['Richard Wellesley', 'Governor-General', 'eic']] },

  { d: '1798-10-22', p: 'hyderabad', ty: 'treaty', f: ['eic', 'hyderabad', 'french'], title: 'The Nizam disarms his French corps',
    sum: 'Under a subsidiary alliance signed in September, the Nizam replaces his large French-officered corps with Company battalions he pays for. Company troops surround the French cantonment and disarm it without a shot. Hyderabad becomes a British client state.',
    forces: [{ f: 'french', who: "French-officered corps (formerly Raymond's)", n: 14000, label: 'c. 14,000 (est.)' }] },

  { d: '1799-05-04', p: 'seringapatam', ty: 'siege', f: ['eic', 'mysore', 'hyderabad'], pv: true, title: 'The Fall of Seringapatam',
    sum: 'Two armies converge on Tipu\'s island capital: General Harris from Madras with the Nizam\'s contingent, including Colonel Arthur Wellesley, and General Stuart from Bombay. After a month\'s siege the breach is stormed in the heat of the afternoon. Tipu Sultan is killed fighting near the Water Gate and his palace is plundered.',
    out: 'Mysore becomes a Company protectorate under the restored Wodeyar dynasty.',
    lead: [['George Harris', 'Company commander', 'eic'], ['Arthur Wellesley', 'Colonel', 'eic'], ['Tipu Sultan', 'Sultan of Mysore, killed', 'mysore'], ['Mir Alam', "commander of the Nizam's contingent", 'hyderabad']],
    forces: [{ f: 'eic', who: 'General George Harris', n: 43000, label: 'c. 43,000', detail: 'about 21,000 Madras army, 16,000 Nizam\'s contingent, 6,400 Bombay army (est.)' }, { f: 'mysore', who: 'Tipu Sultan', n: 35000, label: 'c. 30,000–37,000 (est.)' }],
    moves: [{ f: 'eic', path: ['madras', 'vellore', [78.1, 12.6], [77.2, 12.3], 'seringapatam'], kind: 'march', label: 'Harris', unit: 'artillery' }, { f: 'hyderabad', path: ['hyderabad', [78.6, 14.8], 'vellore'], kind: 'march', label: "Nizam's contingent", unit: 'cavalry' }, { f: 'eic', path: ['cannanore', [75.9, 12.2], 'seringapatam'], kind: 'march', label: 'Stuart', unit: 'sepoy' }] },

  { d: '1800-03-13', p: 'poona', ty: 'political', f: ['maratha'], title: 'Death of Nana Phadnavis',
    sum: 'Nana Phadnavis, who held the Confederacy together for a quarter of a century, dies in Poona. The British Resident wrote that with him went "all the wisdom and moderation of the Maratha government". Daulat Rao Scindia and Yashwantrao Holkar turn on each other.' },

  { d: '1800-10-12', p: 'bellary', ty: 'treaty', f: ['eic', 'hyderabad'], title: 'The Ceded Districts',
    sum: 'To pay for his enlarged subsidiary force, the Nizam cedes to the Company the districts he had gained from Mysore, including Bellary and Cuddapah, thereafter known as the Ceded Districts.' },

  { d: '1801-07-31', p: 'arcot', ty: 'policy', f: ['eic'], title: 'Annexation of the Carnatic',
    sum: 'Citing letters said to show collusion with Tipu, Wellesley forces the Nawab\'s heir to sign away the Carnatic. Madras Presidency now covers most of south-east India; Tanjore was annexed in 1799.' },

  { d: '1801-11-10', p: 'lucknow', ty: 'treaty', f: ['eic', 'awadh'], title: 'Awadh cedes half its lands',
    sum: 'Wellesley compels Nawab Saadat Ali Khan to surrender Rohilkhand, the lower Doab and Allahabad, about half of Awadh, to pay for the Company troops stationed in his kingdom.' },

  { d: '1802-10-25', p: 'poona', ty: 'battle', f: ['maratha'], title: 'Battle of Poona',
    sum: 'Yashwantrao Holkar defeats the combined armies of Daulat Rao Scindia and Peshwa Baji Rao II at Hadapsar outside Poona. The Peshwa flees to the coast and takes refuge with the British at Bassein.',
    moves: [{ f: 'maratha', path: ['indore', [75.2, 20.4], 'poona'], kind: 'march', label: 'Yashwantrao Holkar', unit: 'cavalry' }, { f: 'maratha', path: ['poona', 'bassein'], kind: 'retreat', label: 'Baji Rao II', unit: 'royal' }] },

  { d: '1802-12-31', p: 'bassein', ty: 'treaty', f: ['eic', 'maratha'], title: 'Treaty of Bassein',
    sum: 'The fugitive Peshwa signs a subsidiary alliance: a Company force will be stationed in his lands, paid for with ceded territory, and he will conduct no foreign policy without British approval. To Scindia and the Bhonsle it is a betrayal of Maratha independence, and war follows.' },

  { d: '1803-05-13', p: 'poona', ty: 'march', f: ['eic', 'maratha'], title: 'Baji Rao II restored',
    sum: 'Major-General Arthur Wellesley marches north from Mysore and restores Baji Rao II at Poona. The Peshwa is now a British client.',
    moves: [{ f: 'eic', path: ['seringapatam', [75.8, 14.5], [75.2, 16.5], 'poona'], kind: 'march', label: 'Arthur Wellesley', unit: 'sepoy' }, { f: 'maratha', path: ['bassein', 'poona'], kind: 'march', label: 'Baji Rao II', unit: 'royal' }] },

  { d: '1803-08-12', p: 'ahmednagar', ty: 'siege', f: ['eic', 'maratha'], title: 'Fall of Ahmednagar',
    sum: 'War declared, Arthur Wellesley storms the town of Ahmednagar and accepts the surrender of its fort, a Scindia stronghold, within days.',
    moves: [{ f: 'eic', path: ['poona', 'ahmednagar'], kind: 'march', label: 'Wellesley', unit: 'sepoy' }] },

  { d: '1803-09-04', p: 'aligarh', ty: 'siege', f: ['eic', 'maratha'], title: 'Storming of Aligarh',
    sum: 'In the north, General Gerard Lake attacks Perron\'s headquarters and arsenal at Aligarh. The fortress is stormed through its gates after Perron himself quits Scindia\'s service and surrenders to the British.',
    moves: [{ f: 'eic', path: ['kanpur', [79.4, 27.0], 'aligarh'], kind: 'march', label: 'Lake', unit: 'artillery' }] },

  { d: '1803-09-11', p: 'delhi', ty: 'battle', f: ['eic', 'maratha', 'mughal'], pv: true, title: 'Battle of Delhi',
    sum: 'Across the Yamuna from Delhi, Lake\'s army defeats Scindia\'s French-officered battalions under Louis Bourquien. Five days later Lake is received by Shah Alam, blind, aged and destitute, in the Red Fort. The emperor in whose name the Company has collected Bengal\'s revenues since 1765 is now its pensioner.',
    out: 'The Company takes custody of the Mughal Emperor, and with him the ultimate source of legitimacy in India.',
    lead: [['Gerard Lake', 'Company Commander-in-Chief', 'eic'], ['Louis Bourquien', "Scindia's commander", 'maratha'], ['Shah Alam II', 'Mughal Emperor', 'mughal']],
    forces: [{ f: 'eic', who: 'General Gerard Lake', n: 4500, label: 'c. 4,500' }, { f: 'maratha', who: "Louis Bourquien (Scindia's army)", n: 19000, label: 'c. 19,000 (est.)' }],
    moves: [{ f: 'eic', path: ['aligarh', [77.7, 28.35], 'delhi'], kind: 'march', label: 'Lake', unit: 'sepoy' }] },

  { d: '1803-09-23', p: 'assaye', ty: 'battle', f: ['eic', 'maratha'], pv: true, title: 'Battle of Assaye',
    sum: 'Arthur Wellesley finds the combined armies of Scindia and the Bhonsle Raja of Nagpur where two rivers meet. He crosses an unguarded ford and attacks at once. The Maratha regular infantry and gunners fight with great discipline, but the line breaks after hours of close-range carnage. Wellesley, the future Duke of Wellington, later called it the bloodiest battle for its size he ever saw.',
    out: 'Company casualties exceed 1,500, but Maratha military power in the Deccan is broken.',
    lead: [['Arthur Wellesley', 'Major-General', 'eic'], ['Daulat Rao Scindia', 'Maratha chief', 'maratha'], ['Raghuji II Bhonsle', 'Raja of Nagpur', 'maratha']],
    forces: [{ f: 'eic', who: 'Major-General Arthur Wellesley', n: 9500, label: 'c. 9,500', detail: 'about 7,000 actually engaged' }, { f: 'maratha', who: 'Daulat Rao Scindia & Raghuji II Bhonsle', n: 45000, label: 'c. 40,000–50,000', detail: 'including c. 10,000 European-trained infantry and 100+ guns' }],
    moves: [{ f: 'eic', path: ['ahmednagar', [75.4, 19.6], 'assaye'], kind: 'march', label: 'Wellesley', unit: 'sepoy' }, { f: 'maratha', path: ['burhanpur', [76.1, 20.9], 'assaye'], kind: 'march', label: 'Scindia & Bhonsle', unit: 'sepoy' }] },

  { d: '1803-10-14', p: 'cuttack', ty: 'siege', f: ['eic', 'maratha'], title: 'Conquest of Orissa',
    sum: 'A Company force advances up the coast from the Circars and takes the Barabati fort at Cuttack, completing the conquest of Orissa from the Bhonsle and linking Bengal to Madras by land.',
    moves: [{ f: 'eic', path: [[84.8, 19.3], [85.4, 19.8], 'cuttack'], kind: 'march', label: 'Harcourt', unit: 'sepoy' }] },

  { d: '1803-11-01', p: 'laswari', ty: 'battle', f: ['eic', 'maratha'], title: 'Battle of Laswari',
    sum: 'Lake pursues the last of Scindia\'s northern brigades and destroys them at Laswari after a ferocious battle in which his cavalry charges repeatedly into the Maratha guns.',
    forces: [{ f: 'eic', who: 'General Gerard Lake', n: 10000, label: 'c. 10,000 (est.)' }, { f: 'maratha', who: "Scindia's northern brigades", n: 14000, label: 'c. 14,000', detail: 'about 9,000 infantry, 5,000 cavalry and 72 guns' }],
    moves: [{ f: 'eic', path: ['delhi', 'agra', [77.4, 27.4], 'laswari'], kind: 'march', label: 'Lake', unit: 'cavalry' }] },

  { d: '1803-11-29', p: 'argaon', ty: 'battle', f: ['eic', 'maratha'], title: 'Argaon and Gawilghur',
    sum: 'Wellesley beats the Bhonsle army at Argaon and storms the hill fortress of Gawilghur on 15 December. The Raja of Nagpur sues for peace.',
    moves: [{ f: 'eic', path: ['assaye', [76.5, 20.8], 'argaon'], kind: 'march', label: 'Wellesley', unit: 'sepoy' }] },

  { d: '1803-12-30', p: 'surji', ty: 'treaty', f: ['eic', 'maratha', 'mughal'], pv: true, title: 'The Company Paramount',
    sum: 'By the treaties of Deogaon with the Bhonsle and Surji-Anjangaon with Scindia, the Company annexes Orissa, the Doab, Delhi and Agra, Broach and Ahmednagar. Some sixty years after Nadir Shah sacked Delhi, a London trading corporation with a private army of around 200,000 men, about twice the size of the British Army, rules or controls most of India south of the Sutlej.',
    out: 'The Company is now the paramount power, yet much of India is still ruled by princes bound to it by treaty. The conquest goes on for another half-century.' },

  /* ── Epilogue: the road to the Raj ── */
  { d: '1806-11-19', p: 'delhi', ty: 'political', f: ['mughal', 'eic'], ep: 1, title: 'Death of Shah Alam II',
    sum: 'Shah Alam dies aged 78, a pensioner of the Company in the Red Fort. His son Akbar II inherits the title of emperor but no empire. The Company goes on striking its coins in the Mughal emperor\'s name until 1835.' },

  { d: '1818-06-03', p: 'poona', ty: 'treaty', f: ['eic', 'maratha'], ep: 1, title: 'The end of the Peshwas',
    sum: 'In the Third Anglo-Maratha War the Company crushes the last independent Maratha armies at Khadki, Koregaon and Mahidpur. Baji Rao II surrenders and is pensioned off to Bithur near Cawnpore, and the office of Peshwa is abolished. Holkar, Scindia, the Bhonsle and the Rajput kings become British protectorates.',
    moves: [{ f: 'eic', path: ['bombay', [73.3, 18.75], 'poona'], kind: 'march', unit: 'sepoy', label: 'Company army' }, { f: 'maratha', path: ['poona', 'burhanpur', 'kalpi', 'kanpur'], kind: 'retreat', unit: 'royal', label: 'Baji Rao II into exile' }] },

  { d: '1826-02-24', p: [91.75, 26.18], pname: 'Assam', ty: 'treaty', f: ['eic'], ep: 1, title: 'Assam annexed',
    sum: 'The Treaty of Yandabo ends the First Anglo-Burmese War. Burma gives up Assam, Manipur and the Arakan coast to the Company.' },

  { d: '1843-02-17', p: 'miani', ty: 'battle', f: ['eic'], ep: 1, title: 'Conquest of Sindh',
    sum: 'General Charles Napier defeats the Amirs of Sindh at Miani and annexes their country, a conquest that many in Britain regarded as unprovoked.',
    moves: [{ f: 'eic', path: ['karachi', [67.9, 25.0], 'miani'], kind: 'march', unit: 'sepoy', label: 'Napier' }] },

  { d: '1849-03-29', p: 'lahore', ty: 'treaty', f: ['eic'], ep: 1, title: 'Annexation of the Punjab',
    sum: 'After two hard-fought wars with the Sikh Empire built by Ranjit Singh, Lord Dalhousie annexes the Punjab. The boy Maharaja Duleep Singh is sent into exile, and the Koh-i-Noor, carried off from Delhi by Nadir Shah in 1739, is presented to Queen Victoria.',
    moves: [{ f: 'eic', path: ['delhi', 'karnal', 'sirhind', 'lahore'], kind: 'march', unit: 'army', label: 'Army of the Punjab' }] },

  { d: '1856-02-13', p: 'lucknow', ty: 'policy', f: ['eic', 'awadh'], ep: 1, title: 'Annexation of Awadh',
    sum: 'Dalhousie deposes Wajid Ali Shah, the last Nawab of Awadh, citing misgovernment. Coming after the seizure of Satara, Jhansi and Nagpur under the "doctrine of lapse", it alarms India\'s princes and the Bengal army\'s sepoys, many of whom are recruited from Awadh.' },

  { d: '1857-05-11', p: 'delhi', ty: 'battle', f: ['eic', 'mughal'], ep: 1, pv: true, title: 'The Uprising of 1857',
    sum: 'Sepoys at Meerut mutiny and ride to Delhi, where they proclaim the aged Bahadur Shah Zafar emperor of Hindustan. The revolt spreads across the north, to Cawnpore, Lucknow and Jhansi. After a long siege the British storm Delhi in September and take a terrible revenge. Bahadur Shah is tried and exiled to Rangoon.',
    out: 'The last Mughal emperor is deposed, and Company rule is discredited beyond repair.',
    moves: [{ f: 'mughal', path: ['meerut', [77.45, 28.85], 'delhi'], kind: 'march', unit: 'sepoy', label: 'Meerut sepoys' }, { f: 'eic', path: ['sirhind', 'karnal', 'panipat', 'delhi'], kind: 'march', unit: 'army', label: 'Delhi Field Force' }] },

  { d: '1858-11-01', p: 'allahabad', ty: 'policy', f: ['crown', 'eic'], ep: 1, pv: true, title: 'The British Raj',
    sum: 'At Allahabad, where Clive received the Diwani in 1765, Lord Canning reads Queen Victoria\'s proclamation. Under the Government of India Act the Company\'s territories, army and officials pass to the Crown, and Canning becomes the first Viceroy. The Company itself lingers on in London until it is wound up in 1874.',
    out: 'Here the Company\'s story ends and the British Raj begins.' },
];

const TYPE_META = {
  battle:    { icon: Swords,     label: 'Battle' },
  siege:     { icon: Castle,     label: 'Siege' },
  sack:      { icon: Flame,      label: 'Sack' },
  massacre:  { icon: Skull,      label: 'Atrocity' },
  treaty:    { icon: ScrollText, label: 'Treaty' },
  political: { icon: Crown,      label: 'Court & succession' },
  naval:     { icon: Anchor,     label: 'Naval' },
  famine:    { icon: Wheat,      label: 'Famine' },
  march:     { icon: Footprints, label: 'Campaign' },
  policy:    { icon: Landmark,   label: 'Company government' },
  trade:     { icon: Coins,      label: 'Trade & treasure' },
};

/* Movement formations. Land units use a NATO-style frame; ships and convoys use pictograms. */
const UNITS = {
  sepoy:     { label: 'Drilled infantry',       note: 'Sepoys and European regulars trained to fire in volleys' },
  infantry:  { label: 'Foot levies',            note: 'Irregular infantry and matchlockmen' },
  cavalry:   { label: 'Light cavalry',          note: 'Fast raiding horse, like the Maratha bargis' },
  heavy:     { label: 'Heavy cavalry',          note: 'Armoured shock horse of Mughal, Persian and Afghan armies' },
  artillery: { label: 'Artillery & siege train', note: 'Field guns, rockets and siege trains' },
  army:      { label: 'Field army',             note: 'Combined foot, horse and guns' },
  royal:     { label: 'Royal progress',         icon: Crown,    note: 'An emperor or prince on the move with his court' },
  warship:   { label: 'Fleet',                  icon: Ship,     note: 'Warships and troop transports' },
  merchant:  { label: 'Merchant ships',         icon: Sailboat, trade: 1, note: 'East Indiamen and private "country" ships' },
  treasure:  { label: 'Treasure convoy',        icon: Coins,    trade: 1, note: 'Bullion, tribute and plunder' },
  caravan:   { label: 'Trade goods',            icon: Package,  trade: 1, note: 'Textiles, opium and saltpetre' },
};
const COMP = { european: ['European infantry', 'sepoy'], sepoy: ['sepoys', 'sepoy'], foot: ['foot', 'infantry'], cavalry: ['cavalry', 'cavalry'], heavy: ['heavy cavalry', 'heavy'], guns: ['guns', 'artillery'], ships: ['ships', 'warship'] };
/* Force composition where sources give a breakdown, keyed "date:faction". */
const FORCE_COMP = {
  '1742-04-15:maratha': { cavalry: 25000 },
  '1746-09-21:french': { ships: 9 },
  '1746-11-03:french': { european: 300, sepoy: 700 },
  '1751-02-13:french': { european: 300, sepoy: 2000 },
  '1751-09-01:eic': { european: 200, sepoy: 300, guns: 3 },
  '1756-10-16:eic': { european: 900, sepoy: 1500 },
  '1757-06-23:eic': { european: 900, sepoy: 2100, guns: 10 },
  '1757-06-23:bengal': { foot: 35000, cavalry: 15000, guns: 53 },
  '1760-01-22:eic': { european: 1900, sepoy: 2100, cavalry: 1250, guns: 26 },
  '1760-01-22:french': { european: 2250, sepoy: 1300, guns: 16 },
  '1761-01-14:afghan': { heavy: 42000, foot: 38000 },
  '1761-01-14:maratha': { cavalry: 35000, sepoy: 9000, guns: 200 },
  '1764-10-22:eic': { european: 857, sepoy: 5297, cavalry: 918 },
  '1769-04-04:mysore': { cavalry: 6000 },
  '1798-10-22:french': { sepoy: 14000 },
  '1803-09-23:maratha': { sepoy: 10000, guns: 100 },
  '1803-11-01:maratha': { sepoy: 9000, cavalry: 5000, guns: 72 },
};
/* Money changing hands, keyed by event date. Animated as coins flowing from payer to payee. */
const PAYMENTS = {
  '1751-05-15': [{ from: 'murshidabad', to: 'nagpur', f: 'bengal', amt: 'Rs 12 lakh a year', what: 'Chauth paid by Bengal to the Bhonsle of Nagpur' }],
  '1757-07-06': [
    { from: 'murshidabad', to: 'calcutta', f: 'bengal', amt: 'c. £2.5 million', what: 'Promised by Mir Jafar to the Company and its officers' },
    { from: 'murshidabad', via: [87.95, 23.45], to: 'calcutta', f: 'bengal', amt: 'over £200,000', what: "Clive's personal share" }],
  '1765-08-12': [
    { from: 'murshidabad', via: [87.6, 24.6], to: 'calcutta', f: 'bengal', amt: "Bengal's revenues", what: 'Collected by the Company as Diwan of Bengal, Bihar and Orissa' },
    { from: 'calcutta', to: 'allahabad', f: 'eic', amt: 'Rs 26 lakh a year', what: 'Tribute from the Company to Shah Alam' },
    { from: 'lucknow', to: 'allahabad', f: 'awadh', amt: 'Rs 50 lakh', what: 'Indemnity from Shuja-ud-Daula to the Company' }],
  '1773-09-07': [{ from: 'lucknow', to: 'benares', f: 'awadh', amt: 'Rs 50 lakh', what: 'Shuja-ud-Daula buys Kora and Allahabad from the Company' }],
  '1774-04-23': [{ from: 'lucknow', to: 'calcutta', f: 'awadh', amt: 'Rs 40 lakh', what: 'Shuja-ud-Daula pays for the hire of the Company brigade' }],
  '1781-08-16': [{ from: 'benares', to: 'calcutta', f: 'other', amt: 'Rs 50 lakh demanded', what: 'Fine Hastings demands from Raja Chait Singh' }],
  '1792-03-18': [{ from: 'seringapatam', to: 'madras', f: 'mysore', amt: 'Rs 3.3 crore', what: 'War indemnity paid by Tipu Sultan' }],
  '1798-10-22': [{ from: 'hyderabad', to: 'madras', f: 'hyderabad', amt: 'annual subsidy', what: 'The Nizam pays for the Company battalions stationed at his court' }],
  '1803-09-11': [{ from: 'calcutta', to: 'delhi', f: 'eic', amt: 'Company pension', what: 'A stipend for the blind emperor and his household' }],
  '1818-06-03': [{ from: 'calcutta', to: 'kanpur', f: 'eic', amt: 'Rs 8 lakh a year', what: 'Pension for the deposed Peshwa at Bithur' }],
};

/* Ambient sea lanes of the Company's shipping. */
const TRADE_LANES = [
  { name: 'Cape route to Bombay',  from: 1739, pts: [[60.7, 7.5], [65.5, 11.5], [69.6, 16.0], [72.6, 18.9]] },
  { name: 'Coast route to Surat',  from: 1739, pts: [[69.6, 16.0], [71.3, 19.8], [72.6, 21.0]] },
  { name: 'Cape route to Madras',  from: 1739, pts: [[66.0, 5.4], [74.5, 5.2], [80.6, 5.25], [82.4, 7.4], [81.7, 10.6], [80.4, 12.9]] },
  { name: 'Madras to Calcutta',    from: 1739, pts: [[80.4, 13.1], [82.6, 15.6], [86.6, 19.3], [88.15, 21.6]] },
  { name: 'Calcutta to Canton',    from: 1757, pts: [[88.15, 21.6], [90.6, 18.2], [93.8, 14.6], [97.6, 12.2]] },
];

/* London: indicative series. The shape follows the historical record (the 1767–69 boom,
   the 1772–73 crash, the low of 1783); individual values are rounded approximations. */
const STOCK = [[1739, 150], [1742, 170], [1745, 165], [1748, 175], [1751, 188], [1754, 182], [1756, 165], [1758, 145], [1760, 140], [1762, 145], [1764, 160],
  [1765, 165], [1766, 200], [1767, 250], [1768, 270], [1769, 250], [1770, 225], [1771, 225], [1772, 205], [1773, 155], [1774, 150], [1776, 160], [1778, 145],
  [1780, 140], [1782, 128], [1783, 125], [1784, 135], [1786, 160], [1788, 170], [1790, 170], [1792, 205], [1794, 200], [1796, 180], [1797, 145], [1798, 150],
  [1800, 200], [1802, 210], [1803, 185], [1805, 190]];
const DIVIDEND = [[1739, 7], [1744, 8], [1756, 6], [1766, 10], [1769, 11], [1770, 12], [1771, 12.5], [1773, 6], [1777, 7], [1778, 8], [1793, 10], [1833, 10.5]];
const ARMY = [[1739, 2000], [1750, 3000], [1757, 6000], [1765, 26000], [1778, 67000], [1782, 115000], [1790, 90000], [1796, 100000], [1803, 200000], [1824, 200000], [1857, 300000]];
const LONDON = [
  { d: '1744-04', t: 'Parliament extends the Company\'s charter to 1783 in return for a £1 million loan to the government.' },
  { d: '1763-04', t: 'Clive and Laurence Sulivan fight for control of the Court of Directors; shareholders split their stock to multiply votes.' },
  { d: '1766-04', t: 'News of the Diwani sets off a frenzy of speculation in East India stock.' },
  { d: '1767-06', t: 'After a parliamentary inquiry the Company must pay the state £400,000 a year, and a Dividend Act caps its payouts.' },
  { d: '1769-05', t: 'Bad news from Madras and fear of war with France puncture the boom in East India stock.' },
  { d: '1772-06', t: 'A banking crash spreads from London to Edinburgh. The Company cannot pay its bills and asks the government for a loan.' },
  { d: '1773-05', t: 'Questioned by Parliament about his fortune, Clive says he is "astonished at my own moderation". The House clears him.' },
  { d: '1773-05', t: 'The Tea Act lets the Company ship surplus tea straight to America. In December it is dumped into Boston harbour.' },
  { d: '1773-06', t: 'The Regulating Act creates a Governor-General and a Supreme Court at Calcutta; a £1.4 million loan rescues the Company.' },
  { d: '1774-11', t: 'Robert Clive dies in London, probably by his own hand.' },
  { d: '1783-12', t: "Fox's India Bill, which would have put the Company under parliamentary commissioners, is defeated in the Lords. George III dismisses the Fox–North government." },
  { d: '1784-08', t: "Pitt's India Act sets up a government Board of Control over the Company. The Commutation Act slashes the duty on tea." },
  { d: '1788-02', t: 'The impeachment of Warren Hastings opens in Westminster Hall, led by Edmund Burke.' },
  { d: '1793-06', t: "The Charter Act renews the Company's monopoly for twenty years." },
  { d: '1795-04', t: 'Hastings is acquitted on all charges, ruined by the cost of his defence.' },
  { d: '1805-07', t: 'Alarmed at the cost of his wars, the Directors recall Wellesley.' },
  { d: '1813-07', t: "The Charter Act ends the Company's monopoly of trade with India." },
  { d: '1833-08', t: "The Charter Act ends the Company's trading altogether. It is now purely a government, paid a fixed dividend from India's revenues." },
  { d: '1858-08', t: "The Government of India Act transfers the Company's territories, army and powers to the Crown." },
  { d: '1874-06', t: 'The East India Stock Dividend Redemption Act winds the Company up.' },
].map((x) => ({ ...x, at: parseDate(x.d) }));

/* ════════════════════════════════════════════════════════════════════════════
   7 · MAP DECORATION: rivers, ranges, sea labels  (lon/lat)
   ════════════════════════════════════════════════════════════════════════════ */

const RIVERS = [
  { name: 'Ganges', at: 5, pts: [[78.9, 31.0], [78.16, 29.95], [78.5, 28.9], [79.9, 27.05], [80.33, 26.45], [81.88, 25.43], [83.0, 25.3], [83.98, 25.57], [85.14, 25.6], [86.47, 25.37], [87.83, 25.05], [88.1, 24.6], [88.6, 24.2], [89.5, 23.8], [90.3, 23.4], [90.6, 23.0], [90.8, 22.3]] },
  { name: 'Hooghly', pts: [[88.1, 24.6], [88.27, 24.18], [88.25, 23.8], [88.37, 23.25], [88.4, 22.9], [88.35, 22.57], [88.2, 22.2], [88.05, 21.7]] },
  { name: 'Jumna', at: 3, pts: [[78.45, 31.0], [77.6, 30.3], [77.3, 29.4], [77.25, 28.62], [77.68, 27.5], [78.02, 27.18], [79.0, 26.78], [80.3, 25.9], [81.88, 25.43]] },
  { name: 'Indus', at: 9, pts: [[78.2, 33.9], [76.4, 34.9], [75.2, 35.6], [74.6, 35.8], [73.5, 35.4], [72.9, 34.4], [72.25, 33.9], [71.6, 33.0], [71.0, 31.8], [70.7, 30.0], [70.4, 28.95], [68.86, 27.7], [68.2, 26.4], [68.37, 25.4], [67.8, 24.5], [67.4, 24.0]] },
  { name: 'Sutlej', pts: [[77.3, 31.5], [76.5, 31.4], [76.5, 30.97], [75.8, 30.95], [75.0, 31.1], [74.5, 30.7], [73.5, 30.0], [72.0, 29.3], [71.0, 29.0], [70.5, 28.9]] },
  { name: 'Ravi', pts: [[76.0, 32.4], [75.2, 32.2], [74.3, 31.6], [73.0, 30.8], [71.9, 30.6]] },
  { name: 'Chenab', pts: [[76.2, 33.1], [74.6, 32.8], [73.9, 32.2], [73.0, 31.4], [72.2, 30.6], [71.4, 29.4], [71.0, 29.0]] },
  { name: 'Jhelum', pts: [[74.8, 34.1], [74.0, 34.2], [73.5, 33.4], [73.7, 32.95], [72.6, 32.0], [72.1, 31.2]] },
  { name: 'Brahmaputra', at: 3, pts: [[95.6, 27.9], [94.6, 27.25], [93.8, 26.75], [92.7, 26.6], [91.75, 26.18], [90.5, 26.2], [89.95, 25.9], [89.7, 25.3], [89.8, 24.4], [89.8, 23.85]] },
  { name: 'Godavari', at: 4, pts: [[73.8, 19.95], [75.3, 19.5], [77.3, 19.1], [78.5, 18.9], [80.0, 18.7], [80.9, 17.8], [81.78, 17.0], [82.3, 16.6]] },
  { name: 'Kistna', at: 3, pts: [[73.65, 17.93], [74.6, 16.8], [75.7, 16.4], [76.8, 16.3], [78.05, 15.9], [79.0, 16.3], [80.0, 16.5], [80.6, 16.5], [81.1, 15.8]] },
  { name: 'Tungabhadra', pts: [[75.6, 13.9], [75.8, 14.6], [76.5, 15.3], [77.4, 15.75], [78.05, 15.9]] },
  { name: 'Cauvery', at: 4, pts: [[75.5, 12.4], [76.68, 12.42], [77.2, 12.2], [77.8, 11.9], [78.1, 11.1], [78.7, 10.85], [79.4, 10.95], [79.85, 11.1]] },
  { name: 'Narbada', at: 3, pts: [[81.75, 22.67], [79.95, 23.15], [78.7, 22.8], [77.75, 22.75], [76.2, 22.25], [75.6, 22.18], [74.5, 22.0], [73.0, 21.7], [72.6, 21.65]] },
  { name: 'Tapti', pts: [[78.3, 21.8], [76.2, 21.3], [75.0, 21.1], [74.0, 21.3], [72.83, 21.17], [72.65, 21.1]] },
  { name: 'Mahanadi', at: 3, pts: [[81.8, 20.4], [82.0, 21.4], [83.4, 21.6], [83.97, 21.47], [84.8, 20.8], [85.88, 20.46], [86.6, 20.3]] },
  { name: 'Chambal', pts: [[75.7, 22.5], [75.6, 23.7], [75.8, 25.0], [75.83, 25.18], [76.8, 26.0], [78.3, 26.5], [79.1, 26.45]] },
  { name: 'Gogra', pts: [[81.5, 28.6], [81.9, 27.3], [82.15, 26.78], [83.5, 26.2], [84.6, 25.75]] },
];
const RANGES = [
  { name: 'HIMALAYA', lab: [82.2, 30.2], pts: [[72.5, 35.8], [74.5, 35.2], [76.0, 34.3], [77.5, 33.0], [78.8, 31.2], [80.5, 30.0], [82.5, 29.0], [84.5, 28.4], [86.5, 28.0], [88.5, 27.9], [90.5, 28.0], [92.5, 27.9], [94.5, 28.4], [96.5, 28.6]] },
  { name: 'HINDU KUSH', lab: [68.8, 35.6], pts: [[66.5, 34.6], [68.5, 35.0], [70.0, 35.4], [71.5, 36.1]] },
  { name: 'SULAIMAN', pts: [[69.8, 31.8], [69.6, 30.6], [69.0, 29.5], [68.2, 28.7]] },
  { name: 'ARAVALLI', pts: [[73.2, 24.2], [73.9, 25.0], [74.4, 25.8], [75.2, 26.6], [75.9, 27.4], [76.6, 28.2]] },
  { name: 'VINDHYA', pts: [[74.6, 23.4], [76.0, 23.6], [77.5, 23.7], [79.0, 24.0], [80.5, 24.3]] },
  { name: 'SATPURA', pts: [[74.5, 21.8], [75.8, 21.7], [77.0, 21.9], [78.4, 22.1], [79.5, 22.35]] },
  { name: 'WESTERN GHATS', pts: [[73.65, 20.8], [73.6, 19.4], [73.75, 17.9], [74.0, 16.4], [74.4, 15.0], [75.1, 13.5], [75.8, 12.0], [76.6, 10.8], [77.1, 9.4], [77.3, 8.5]] },
  { name: 'EASTERN GHATS', pts: [[83.7, 19.2], [82.7, 18.2], [81.4, 17.2], [79.7, 15.6], [79.2, 14.2], [78.8, 13.0], [78.3, 11.8]] },
];
const SEA_LABELS = [
  { t: 'ARABIAN SEA', ll: [66.3, 16.8], s: 15 }, { t: 'BAY OF BENGAL', ll: [87.6, 15.2], s: 15 },
  { t: 'INDIAN OCEAN', ll: [72.0, 7.4], s: 13 }, { t: 'TIBET', ll: [86.2, 31.6], s: 11, land: 1 },
  { t: 'BURMA', ll: [95.6, 21.0], s: 10, land: 1 }, { t: 'TURAN', ll: [66.0, 37.4], s: 10, land: 1 },
];

/* ════════════════════════════════════════════════════════════════════════════
   8 · GEOMETRY HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeIOInv = (f) => (f < 0.5 ? Math.sqrt(f / 2) : 1 - Math.sqrt((1 - f) / 2));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function parseDate(s) { const [y, m = 1, d = 1] = s.split('-').map(Number); return y + (m - 1) / 12 + (d - 1) / 365; }
const fmtDate = (s) => { const [y, m, d] = s.split('-').map(Number); return d ? `${d} ${MONTHS[m - 1]} ${y}` : m ? `${MONTHS[m - 1]} ${y}` : `${y}`; };
const fmtMonth = (t) => { const y = Math.floor(t); const m = clamp(Math.floor((t - y) * 12 + 1e-6), 0, 11); return `${MONTHS[m].slice(0, 3)} ${y}`; };
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/* Smooth hand-drawn wobble: random offsets low-pass filtered along the ring. */
function wobble(ring, amp, seed, closed = true) {
  const r = rng(seed), n = ring.length;
  let ox = ring.map(() => (r() - 0.5) * 2), oy = ring.map(() => (r() - 0.5) * 2);
  for (let pass = 0; pass < 3; pass++) {
    const sx = [], sy = [];
    for (let i = 0; i < n; i++) {
      const a = closed ? (i - 1 + n) % n : Math.max(0, i - 1), b = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
      sx.push((ox[a] + 2 * ox[i] + ox[b]) / 4); sy.push((oy[a] + 2 * oy[i] + oy[b]) / 4);
    }
    ox = sx; oy = sy;
  }
  return ring.map(([x, y], i) => [x + ox[i] * amp * 1.8, y + oy[i] * amp * 1.8]);
}
const ptsD = (pts, close) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + (close ? 'Z' : '');
const ringsD = (rings) => rings.map((r) => ptsD(r, true)).join('');
const roughD = (rings, amp, seed, closed = true, step = 1) =>
  rings.map((r, k) => ptsD(wobble(step > 1 ? r.filter((_, i) => i % step === 0) : r, amp, seed + k * 7, closed), closed)).join('');

function catmull(pts, seg = 8) {
  if (pts.length < 2) return pts.slice();
  if (pts.length === 2) { // arch a straight leg slightly so marches read as routes
    const [a, b] = pts, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
    pts = [a, [mx - dy * 0.12, my + dx * 0.12], b];
  }
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let j = 0; j < seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function polyLen(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; }
function partial(pts, L, p) {
  const target = L[L.length - 1] * clamp(p, 0, 1);
  let i = 1; while (i < L.length - 1 && L[i] < target) i++;
  const seg = L[i] - L[i - 1] || 1, f = clamp((target - L[i - 1]) / seg, 0, 1);
  const a = pts[i - 1], b = pts[i] || a, head = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  return { pts: [...pts.slice(0, i), head], head, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
}
function ringArea(r) { let a = 0; for (let i = 0; i < r.length; i++) { const [x0, y0] = r[i], [x1, y1] = r[(i + 1) % r.length]; a += x0 * y1 - x1 * y0; } return Math.abs(a / 2); }
function pointInRings([x, y], rings) {
  let inside = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* Lazily-built derived geography (GEO is defined at the bottom of the file). */
let _G = null;
function geo() {
  if (_G) return _G;
  const dec = (s) => (s ? s.split('|').map((r) => r.split(' ').map((p) => p.split(',').map(Number))) : []);
  const { lon0, lat1, k } = GEO.proj;
  const merc = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
  const M1 = merc(lat1);
  const project = ([lon, lat]) => [(lon - lon0) * k, (M1 - merc(lat)) * k];
  const land = dec(GEO.land), borders = dec(GEO.borders);
  const regions = {};
  for (const [id, v] of Object.entries(GEO.regions)) {
    const rings = dec(v.r);
    regions[id] = { id, rings, c: v.c, d: ringsD(rings), area: rings.reduce((s, r) => s + ringArea(r), 0) };
  }
  const places = Object.fromEntries(Object.entries(PLACES).map(([id, [name, lon, lat, major, left]]) => [id, { id, name, xy: project([lon, lat]), major: major || 0, left: !!left }]));
  const coast = coastRuns(land, GEO.W, GEO.H);
  const events = EVENTS_RAW.map((e, i) => {
    const xy = Array.isArray(e.p) ? project(e.p) : places[e.p].xy;
    const pname = e.pname || (Array.isArray(e.p) ? '' : places[e.p].name);
    const moves = (e.moves || []).map((m) => {
      const raw = m.path.map((q) => (Array.isArray(q) ? project(q) : places[q].xy));
      const pts = catmull(raw, 10);
      return { ...m, pts, L: polyLen(pts) };
    });
    const region = Object.keys(regions).find((id) => pointInRings(xy, regions[id].rings)) || null;
    const forces = e.forces && e.forces.map((x) => ({ ...x, comp: FORCE_COMP[`${e.d}:${x.f}`] }));
    const pays = (PAYMENTS[e.d] || []).map((q) => {
      const raw = [places[q.from].xy, ...(q.via ? [project(q.via)] : []), places[q.to].xy];
      const pts = catmull(raw, 12);
      return { ...q, pts, L: polyLen(pts), fromName: places[q.from].name, toName: places[q.to].name };
    });
    return { ...e, forces, pays, id: `ev${i}`, t: parseDate(e.d), xy, pname, moves, region };
  }).sort((a, b) => a.t - b.t);
  _G = {
    W: GEO.W, H: GEO.H, project, land, borders, regions, places, events,
    enclaves: Object.fromEntries(Object.entries(ENCLAVES).map(([id, [name, lon, lat]]) => [id, { id, name, xy: project([lon, lat]) }])),
    coastA: roughD(coast, 0.55, 11, false), coastB: roughD(coast, 0.9, 29, false, 2), coastD: coast.map((r) => ptsD(r, false)).join(''), landD: ringsD(land),
    bordersD: borders.map((l) => ptsD(wobble(l, 0.5, 5, false), false)).join(''),
    rivers: RIVERS.map((rv, i) => { const pts = catmull(rv.pts.map(project), 6); return { ...rv, d: ptsD(wobble(pts, 0.35, 90 + i, false), false), lab: project(rv.pts[rv.at ?? Math.floor(rv.pts.length / 2)]) }; }),
    mountains: buildMountains(project),
    rangeLabels: RANGES.filter((r) => r.lab).map((r) => ({ name: r.name, xy: project(r.lab) })),
    seaLabels: SEA_LABELS.map((s) => ({ ...s, xy: project(s.ll) })),
    lanes: TRADE_LANES.map((l) => { const pts = catmull(l.pts.map(project), 8); return { ...l, pts, L: polyLen(pts), d: ptsD(pts) }; }),
  };
  return _G;
}
/* Land rings are clipped to a padded box; drop the box edges so they are never stroked as coast. */
function coastRuns(rings, W, H) {
  const E = 39, on = ([x, y]) => x <= -E || x >= W + E || y <= -E || y >= H + E, runs = [];
  for (const r of rings) {
    const n = r.length; let start = -1;
    for (let i = 0; i < n; i++) if (on(r[i]) && on(r[(i + 1) % n])) { start = (i + 1) % n; break; }
    if (start < 0) { runs.push([...r, r[0]]); continue; }
    let cur = [];
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n, j = (i + 1) % n;
      cur.push(r[i]);
      if (on(r[i]) && on(r[j])) { if (cur.length > 1) runs.push(cur); cur = []; }
    }
    if (cur.length > 1) runs.push(cur);
  }
  return runs;
}
function buildMountains(project) {
  const r = rng(4242); let d = '';
  for (const rg of RANGES) {
    const pts = catmull(rg.pts.map(project), 6), L = polyLen(pts), total = L[L.length - 1];
    for (let s = 0; s < total; s += 7.5 + r() * 3) {
      const { head: [x, y], angle } = partial(pts, L, s / total);
      const nrm = ((angle + 90) * Math.PI) / 180, off = (r() - 0.5) * 9;
      const cx = x + Math.cos(nrm) * off, cy = y + Math.sin(nrm) * off, w = 2.6 + r() * 1.8, h = 2.4 + r() * 2.2;
      d += `M${(cx - w).toFixed(1)},${(cy + h * 0.5).toFixed(1)}L${cx.toFixed(1)},${(cy - h).toFixed(1)}L${(cx + w * 0.7).toFixed(1)},${(cy + h * 0.3).toFixed(1)}`;
    }
  }
  return d;
}

/* ════════════════════════════════════════════════════════════════════════════
   9 · NARRATIVE CLOCK — playback time τ (seconds) ↔ historical year t
   ════════════════════════════════════════════════════════════════════════════ */

function buildClock(events) {
  const segs = []; let tau = 0, prevT = T0;
  events.forEach((e, i) => {
    const travel = clamp(0.9 + (e.t - prevT) * 0.5, 0.9, 3.4), dwell = e.pv ? 9.5 : e.ep ? 5 : 6;
    segs.push({ i, t0: prevT, t1: e.t, a: tau, b: tau + travel, c: tau + travel + dwell });
    tau += travel + dwell; prevT = e.t;
  });
  return { segs, total: tau + 2 };
}
function clockAt(clock, tau) {
  const { segs } = clock;
  if (!segs.length) return { t: T0, idx: -1, phase: 'travel' };
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid].a <= tau) lo = mid; else hi = mid - 1; }
  const s = segs[lo];
  if (tau < s.a) return { t: T0, idx: -1, phase: 'travel' };
  if (tau < s.b) return { t: lerp(s.t0, s.t1, easeIO((tau - s.a) / (s.b - s.a))), idx: lo - 1, phase: 'travel' };
  return { t: s.t1, idx: lo, phase: 'dwell', f: clamp((tau - s.b) / (s.c - s.b), 0, 1) };
}
function tauForYear(clock, t) {
  const { segs } = clock;
  if (!segs.length) return 0;
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    if (t < s.t1) { if (t <= s.t0) return s.a; return s.a + easeIOInv((t - s.t0) / (s.t1 - s.t0)) * (s.b - s.a); }
    if (t === s.t1) return s.b + 0.001;
  }
  return segs[segs.length - 1].b + 0.001;
}

/* ════════════════════════════════════════════════════════════════════════════
   10 · STYLES
   ════════════════════════════════════════════════════════════════════════════ */

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .38  0 0 0 0 .30  0 0 0 0 .2  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}")`;
const MOTTLE = `url("data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.006' numOctaves='4' seed='7'/><feColorMatrix values='0 0 0 0 .55  0 0 0 0 .42  0 0 0 0 .25  0 0 0 .9 -.32'/></filter><rect width='100%' height='100%' filter='url(%23m)'/></svg>")}")`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');
.atlas{--paper:#F7F3EA;--paper-2:#EFE7D6;--ink:#3a3026;--ink-2:#6e604f;--rule:#cbbd9f;--sea:#8fa6b3;--accent:#8a3b22;
  font-family:'EB Garamond','Iowan Old Style',Georgia,serif;color:var(--ink);background:var(--paper)}
.atlas .display{font-family:'Cormorant Garamond','EB Garamond',Georgia,serif}
.atlas .sc{font-variant:small-caps;letter-spacing:.09em}
.atlas .caps{text-transform:uppercase;letter-spacing:.16em}
.atlas .num{font-variant-numeric:tabular-nums lining-nums}
.atlas button:focus-visible,.atlas [role=slider]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.atlas .paper-bg{background-color:#F1EADB}
.atlas .mist{background:radial-gradient(ellipse 75% 70% at 50% 50%,rgba(241,234,219,0) 55%,rgba(241,234,219,.55) 82%,rgba(241,234,219,.92) 100%)}
.atlas .grain{background-image:${GRAIN};mix-blend-mode:multiply;opacity:.09}
.atlas .mottle{background-image:${MOTTLE};background-size:900px 900px;mix-blend-mode:multiply;opacity:.06}
@keyframes atl-pulse{0%{transform:scale(.55);opacity:.85}100%{transform:scale(2.3);opacity:0}}
.atl-pulse{transform-box:fill-box;transform-origin:center;animation:atl-pulse 2.4s ease-out infinite}
@keyframes atl-march{to{stroke-dashoffset:-24}}
.atl-march{animation:atl-march 1.2s linear infinite}
@keyframes atl-wave{0%,100%{transform:skewY(0) scaleX(1)}50%{transform:skewY(-7deg) scaleX(.9)}}
.atl-wave{transform-box:fill-box;transform-origin:left center;animation:atl-wave 1.7s ease-in-out infinite}
@keyframes atl-spin{to{transform:rotate(360deg)}}
.atl-spin{transform-box:fill-box;transform-origin:center;animation:atl-spin 22s linear infinite}
@keyframes atl-pop{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.atl-pop{animation:atl-pop .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes atl-flash{0%,100%{stroke-opacity:.2}50%{stroke-opacity:.95}}
.atl-flash{animation:atl-flash 1.5s ease-in-out infinite}
@keyframes atl-fade{from{opacity:.35}to{opacity:1}}
.atl-fade{animation:atl-fade .8s ease both}
.atlas .no-scrollbar::-webkit-scrollbar{display:none}.atlas .no-scrollbar{scrollbar-width:none}
.atlas .thin-scroll::-webkit-scrollbar{width:6px}.atlas .thin-scroll::-webkit-scrollbar-thumb{background:#d6c8aa;border-radius:3px}
@media (prefers-reduced-motion:reduce){.atl-pulse,.atl-march,.atl-wave,.atl-spin,.atl-flash{animation:none}}
`;

/* ════════════════════════════════════════════════════════════════════════════
   11 · STATIC MAP LAYERS (memoised)
   ════════════════════════════════════════════════════════════════════════════ */

const NS = { vectorEffect: 'non-scaling-stroke' };

const SeaAndLand = memo(function SeaAndLand() {
  const G = geo();
  return (
    <g>
      {/* engraved water-lines hugging the coast */}
      {[18, 11, 6].map((w, i) => (
        <path key={w} d={G.coastD} fill="none" stroke="#7d98a8" strokeOpacity={[0.06, 0.09, 0.14][i]} strokeWidth={w} strokeLinejoin="round" />
      ))}
      <path d={G.coastD} fill="none" stroke="#7d98a8" strokeOpacity={0.35} strokeWidth={0.5} transform="translate(0.8 1.2)" {...NS} />
      <path d={G.landD} fill="#ece3cf" />
    </g>
  );
});

const Relief = memo(function Relief() {
  const G = geo();
  return (
    <g pointerEvents="none">
      <path d={G.mountains} fill="none" stroke="#5e4c39" strokeOpacity={0.42} strokeWidth={0.75} strokeLinecap="round" strokeLinejoin="round" {...NS} />
      {G.rivers.map((r) => (
        <path key={r.name} d={r.d} fill="none" stroke="#6f8ea0" strokeOpacity={0.75} strokeWidth={r.name === 'Ganges' || r.name === 'Indus' ? 1.3 : 0.85} strokeLinecap="round" {...NS} />
      ))}
    </g>
  );
});

const Borders = memo(function Borders() {
  const G = geo();
  const regionLines = useMemo(() => Object.values(G.regions).map((r, i) => roughD(r.rings, 0.45, 300 + i * 13)).join(''), [G]);
  return (
    <g pointerEvents="none">
      <path d={regionLines} fill="none" stroke="#4d3d2e" strokeOpacity={0.3} strokeWidth={0.7} strokeDasharray="5 1.6 1 1.6" strokeLinejoin="round" {...NS} />
      <path d={G.bordersD} fill="none" stroke="#6b5a47" strokeOpacity={0.32} strokeWidth={0.7} strokeDasharray="2 2.5" {...NS} />
      <path d={G.coastB} fill="none" stroke="#3b3027" strokeOpacity={0.3} strokeWidth={0.6} strokeLinejoin="round" {...NS} />
      <path d={G.coastA} fill="none" stroke="#33291f" strokeOpacity={0.82} strokeWidth={1.05} strokeLinejoin="round" {...NS} />
    </g>
  );
});

const Labels = memo(function Labels({ kq }) {
  const G = geo();
  const z = kq / 8;
  return (
    <g pointerEvents="none" className="display">
      {G.seaLabels.map((s) => (
        <text key={s.t} x={s.xy[0]} y={s.xy[1]} textAnchor="middle" fontSize={s.s / Math.sqrt(z)} fontStyle="italic"
          fill={s.land ? '#8a7a64' : '#6d8796'} letterSpacing={s.land ? '0.3em' : '0.55em'} opacity={0.85}>{s.t}</text>
      ))}
      {G.rangeLabels.map((r) => (
        <text key={r.name} x={r.xy[0]} y={r.xy[1]} textAnchor="middle" fontSize={7.5 / Math.sqrt(z)} fill="#7a6650" letterSpacing="0.5em" opacity={0.7}>{r.name}</text>
      ))}
      {z >= 1.4 && G.rivers.map((r) => (
        <text key={r.name} x={r.lab[0] + 3} y={r.lab[1] - 3} fontSize={8.5 / z} fontStyle="italic" fill="#5f7f91" opacity={0.85}>{r.name}</text>
      ))}
      {Object.entries(REGIONS).map(([id, info]) => {
        const r = G.regions[id];
        if (!r || !r.c || (info.small && z < 1.25)) return null;
        const fs = (info.small ? 7.5 : 10.5) / Math.pow(z, 0.75);
        return (
          <text key={id} x={r.c[0]} y={r.c[1]} textAnchor="middle" fontSize={fs} fontWeight={600} fill="#3e3127" opacity={0.6}
            letterSpacing="0.22em" style={{ paintOrder: 'stroke', stroke: 'rgba(247,243,234,.55)', strokeWidth: 2.2 / z }}>
            {info.name.toUpperCase()}
          </text>
        );
      })}
    </g>
  );
});

/* Territory fills; memoised on a string key of the current control state. */
const Territories = memo(function Territories({ stateKey, visKey }) {
  const G = geo();
  const states = JSON.parse(stateKey);
  const vis = JSON.parse(visKey);
  return (
    <g>
      {Object.keys(REGIONS).map((id) => {
        const r = G.regions[id]; if (!r) return null;
        const st = states[id];
        const shown = vis.includes(st.f);
        const fill = shown ? FACTIONS[st.f].color : st.f === 'other' ? FACTIONS.other.color : MUTED;
        const ctx = id === 'persia' || id === 'afghanistan';
        return (
          <g key={id}>
            <path d={r.d} data-region={id} style={{ fill, fillOpacity: shown ? (ctx ? 0.42 : 0.62) : 0.5, transition: 'fill 1.3s ease, fill-opacity .9s ease', cursor: 'pointer' }}
              stroke={fill} strokeOpacity={shown ? 0.6 : 0.3} strokeWidth={2.2} strokeLinejoin="round" {...NS} />
            {st.over && vis.includes(st.over) && (
              <path d={r.d} fill={`url(#hatch-${st.over})`} pointerEvents="none" className="atl-fade" />
            )}
          </g>
        );
      })}
    </g>
  );
});

/* ════════════════════════════════════════════════════════════════════════════
   12 · DYNAMIC MAP PIECES
   ════════════════════════════════════════════════════════════════════════════ */

function Banner({ x, f, flip }) {
  const c = FACTIONS[f];
  return (
    <g transform={`translate(${x} 0) scale(${flip ? -1 : 1} 1)`}>
      <line x1={0} y1={2} x2={0} y2={-30} stroke="#3a3026" strokeWidth={1.2} />
      <circle cx={0} cy={-31} r={1.6} fill="#3a3026" />
      <path className="atl-wave" d="M0,-29 L16,-29 L11.5,-24.5 L16,-20 L0,-20 Z" fill={c.color} stroke={c.ink} strokeWidth={0.9} />
    </g>
  );
}

function EventMarker({ ev, z, onClick }) {
  const Icon = TYPE_META[ev.ty].icon;
  const main = ev.f.find((f) => f !== 'other') || 'other';
  const ink = FACTIONS[main].ink;
  const banners = (ev.forces || []).map((x) => x.f).filter((f, i, a) => a.indexOf(f) === i).slice(0, 2);
  const s = 1 / z;
  return (
    <g transform={`translate(${ev.xy[0]} ${ev.xy[1]}) scale(${s})`} style={{ cursor: 'pointer' }} onClick={onClick}>
      <circle r={16} fill="none" stroke={ink} strokeWidth={1.5} className="atl-pulse" />
      {ev.ty === 'siege' && <circle r={24} fill="none" stroke={ink} strokeWidth={1.4} strokeDasharray="3 4" className="atl-spin" />}
      {ev.ty === 'battle' && [0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1={0} y1={-17} x2={0} y2={-22} stroke={ink} strokeWidth={1.3} transform={`rotate(${a})`} strokeLinecap="round" />
      ))}
      {banners[0] && <Banner x={-17} f={banners[0]} flip />}
      {banners[1] && <Banner x={17} f={banners[1]} />}
      <circle r={13.5} fill="#FBF8F1" stroke={ink} strokeWidth={1.6} />
      <circle r={10.8} fill="none" stroke={ink} strokeWidth={0.5} strokeOpacity={0.6} />
      <Icon x={-8} y={-8} width={16} height={16} color={ink} strokeWidth={1.9} />
      <text y={30} textAnchor="middle" className="display" fontSize={13} fontWeight={700} fill="#2f251c"
        style={{ paintOrder: 'stroke', stroke: '#F7F3EA', strokeWidth: 4, strokeLinejoin: 'round' }} letterSpacing="0.06em">
        {ev.title}
      </text>
    </g>
  );
}

/* A formation symbol centred on 0,0 (about 16×11 units). */
function UnitGlyph({ unit, c }) {
  const u = UNITS[unit] || UNITS.army;
  if (u.icon) {
    const I = u.icon;
    return (
      <g>
        <circle r={9.5} fill="#FBF8F1" stroke={c.ink} strokeWidth={1.3} strokeDasharray={u.trade ? '2.5 1.5' : undefined} />
        <I x={-6} y={-6} width={12} height={12} color={c.ink} strokeWidth={2} />
      </g>
    );
  }
  const ink = c.ink;
  return (
    <g>
      <rect x={-8} y={-5.5} width={16} height={11} fill={c.color} stroke={ink} strokeWidth={1.2} />
      {(unit === 'infantry' || unit === 'sepoy' || unit === 'army') && <path d="M-8,-5.5L8,5.5M-8,5.5L8,-5.5" stroke={ink} strokeWidth={0.9} />}
      {unit === 'sepoy' && <rect x={-8} y={-5.5} width={16} height={2.8} fill={ink} />}
      {(unit === 'cavalry' || unit === 'heavy') && <path d="M-8,5.5L8,-5.5" stroke={ink} strokeWidth={1.2} />}
      {unit === 'heavy' && <path d="M-8,-5.5L-1.5,-5.5L-8,-0.8ZM8,5.5L1.5,5.5L8,0.8Z" fill={ink} />}
      {(unit === 'artillery' || unit === 'army') && <circle r={2.5} fill={ink} />}
    </g>
  );
}
/* The symbol stays upright; a small chevron in front shows the direction of travel. */
function UnitHead({ unit, c, angle }) {
  const a = (angle * Math.PI) / 180, r = 13.5;
  return (
    <g>
      <g transform={`translate(${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}) rotate(${angle.toFixed(1)})`}><path d="M-2.5,-4L3,0L-2.5,4Z" fill={c.ink} /></g>
      <UnitGlyph unit={unit} c={c} />
    </g>
  );
}
function GlyphSwatch({ unit, f = 'other', size = 20 }) {
  const c = f === 'other' ? { color: '#e9dfca', ink: '#3a3026' } : FACTIONS[f];
  return <svg width={size} height={size * 0.72} viewBox="-11 -8 22 16" className="shrink-0" aria-hidden="true"><g transform="scale(.78)"><UnitGlyph unit={unit} c={c} /></g></svg>;
}

function MoveLine({ mv, p, z, faded }) {
  const c = FACTIONS[mv.f] || FACTIONS.other;
  const part = partial(mv.pts, mv.L, p);
  const water = mv.kind === 'naval' || mv.kind === 'river', retreat = mv.kind === 'retreat';
  const unit = mv.unit || (water ? 'warship' : 'army');
  const trade = !!(UNITS[unit] && UNITS[unit].trade);
  const fullD = ptsD(mv.pts), partD = ptsD(part.pts);
  const dash = water ? '1.5 5' : trade ? '2 3.5' : retreat ? '3 4' : '8 4';
  if (faded) return <path d={fullD} fill="none" stroke={c.ink} strokeOpacity={0.22} strokeWidth={1.4} strokeDasharray={water || trade ? '1 4' : '5 4'} strokeLinecap="round" {...NS} />;
  return (
    <g pointerEvents="none">
      <path d={fullD} fill="none" stroke={c.ink} strokeOpacity={0.18} strokeWidth={1.4} strokeDasharray="2 4" strokeLinecap="round" {...NS} />
      <path d={partD} fill="none" stroke="#FBF8F1" strokeOpacity={0.75} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" {...NS} />
      <path d={partD} fill="none" stroke={c.color} strokeWidth={trade ? 2.4 : 3.2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.9} {...NS} />
      <path d={partD} fill="none" stroke={c.ink} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} className="atl-march" {...NS} />
      <g transform={`translate(${part.head[0]} ${part.head[1]}) scale(${1 / z})`} opacity={retreat ? 0.8 : 1}>
        <UnitHead unit={unit} c={c} angle={part.angle} />
        {mv.label && p > 0.04 && (
          <text x={0} y={-16} textAnchor="middle" fontSize={10.5} fontStyle="italic" fill={c.ink} className="display" fontWeight={600}
            style={{ paintOrder: 'stroke', stroke: '#F7F3EA', strokeWidth: 3.5, strokeLinejoin: 'round' }}>{mv.label}</text>
        )}
      </g>
    </g>
  );
}

/* Coins stream along an arc from payer to payee, with the sum labelled at the midpoint. */
function PaymentFlow({ pay, secs, z, idx }) {
  const c = FACTIONS[pay.f] || FACTIONS.other;
  const sym = pay.amt.includes('£') ? '£' : '₹';
  const grow = clamp((secs - 0.3) / 1.2, 0, 1);
  const shown = partial(pay.pts, pay.L, grow);
  const mid = partial(pay.pts, pay.L, 0.5).head;
  return (
    <g pointerEvents="none">
      <path d={ptsD(shown.pts)} fill="none" stroke="#a37c22" strokeOpacity={0.8} strokeWidth={1.6} strokeDasharray="1 3.5" strokeLinecap="round" {...NS} />
      {grow >= 1 && [0, 1, 2, 3, 4].map((i) => {
        const pr = (secs * 0.32 + i / 5 + idx * 0.13) % 1;
        const { head } = partial(pay.pts, pay.L, pr);
        const fade = Math.min(1, pr * 6, (1 - pr) * 6);
        return (
          <g key={i} transform={`translate(${head[0]} ${head[1]}) scale(${1 / z})`} opacity={fade}>
            <circle r={5.6} fill="#e4c15a" stroke="#7a5a14" strokeWidth={1} />
            <circle r={3.6} fill="none" stroke="#7a5a14" strokeWidth={0.6} />
            <text y={2.3} textAnchor="middle" fontSize={6.4} fontWeight={700} fill="#5c420c">{sym}</text>
          </g>
        );
      })}
      {grow >= 1 && (
        <g transform={`translate(${mid[0]} ${mid[1]}) scale(${1 / z})`}>
          <rect x={-pay.amt.length * 3.1 - 8} y={-21} width={pay.amt.length * 6.2 + 16} height={15} rx={7.5} fill="#fbf6e6" stroke="#a37c22" strokeWidth={0.9} />
          <text y={-10.5} textAnchor="middle" fontSize={10} fontWeight={600} fill={c.ink} className="display num">{pay.amt}</text>
        </g>
      )}
    </g>
  );
}

function enclaveBlob(seed) {
  const r = rng(seed); const pts = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = 1 + (r() - 0.5) * 0.5; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return ptsD(wobble(pts, 0.06, seed), true);
}
const BLOBS = Array.from({ length: 12 }, (_, i) => enclaveBlob(77 + i * 31));

/* ════════════════════════════════════════════════════════════════════════════
   13 · SIDE PANEL PIECES
   ════════════════════════════════════════════════════════════════════════════ */

function FactionDot({ f, size = 10 }) {
  const c = FACTIONS[f] || FACTIONS.other;
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: c.color, boxShadow: `inset 0 0 0 1.2px ${c.ink}` }} />;
}
function FactionChip({ f }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8cbb0] bg-[#fbf8f1] px-2 py-0.5 text-[12px] leading-5 text-[#4a3d30]">
      <FactionDot f={f} size={8} />{FACTIONS[f].short}
    </span>
  );
}
function SectionTitle({ children, icon: Icon }) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-2 border-b border-[#d9ccb2] pb-1 text-[11px] font-semibold text-[#7a6650] caps">
      {Icon && <Icon size={13} strokeWidth={1.8} />}{children}
    </div>
  );
}

function ForcesBlock({ forces }) {
  const max = Math.max(...forces.map((x) => x.n || 0), 1);
  return (
    <div className="flex flex-col gap-3">
      {forces.map((x, i) => {
        const c = FACTIONS[x.f] || FACTIONS.other;
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-[#2f251c]"><FactionDot f={x.f} /><span className="truncate">{x.who}</span></div>
              <div className="shrink-0 num text-[14px] font-semibold" style={{ color: c.ink }}>{x.label}</div>
            </div>
            <div className="mt-1 h-[7px] w-full rounded-full bg-[#ece3d0]">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, ((x.n || 0) / max) * 100)}%`, background: c.color, boxShadow: `inset 0 0 0 1px ${c.ink}55` }} />
            </div>
            {x.detail && <div className="mt-1 text-[12.5px] italic leading-snug text-[#6e604f]">{x.detail}</div>}
            {x.comp && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(x.comp).map(([k, n]) => (
                  <span key={k} className="num inline-flex items-center gap-1 rounded border border-[#e0d4bb] bg-[#fbf8f1] px-1.5 py-0.5 text-[12px] text-[#4a3d30]" title={UNITS[COMP[k][1]].note}>
                    <GlyphSwatch unit={COMP[k][1]} f={x.f} size={18} />{n.toLocaleString('en-GB')} {COMP[k][0]}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const lerpSeries = (data, t) => {
  if (t <= data[0][0]) return data[0][1];
  for (let i = 1; i < data.length; i++) if (t <= data[i][0]) { const [a, va] = data[i - 1], [b, vb] = data[i]; return va + ((vb - va) * (t - a)) / (b - a); }
  return data[data.length - 1][1];
};
const stepSeries = (data, t) => { let v = data[0][1]; for (const [a, x] of data) if (a <= t) v = x; return v; };

/* Small single-series chart with a playhead at the atlas date and a hover crosshair. */
function MiniChart({ title, unit, data, x0, x1, yMin, yMax, yTicks, xTicks, year, step, fmt, tickFmt = (v) => v, notes = [] }) {
  const [hv, setHv] = useState(null);
  const W = 340, H = 132, L = 34, R = 10, T = 12, B = 20;
  const X = (t) => L + ((t - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const valAt = (t) => (step ? stepSeries(data, t) : lerpSeries(data, t));
  const end = step ? x1 : data[data.length - 1][0];
  let d = '';
  data.forEach(([t, v], i) => { const x = X(t).toFixed(1), y = Y(v).toFixed(1); d += i === 0 ? `M${x},${y}` : step ? `H${x}V${y}` : `L${x},${y}`; });
  if (step) d += `H${X(x1).toFixed(1)}`;
  const area = `${d}V${Y(yMin).toFixed(1)}H${X(data[0][0]).toFixed(1)}Z`;
  const showYear = year >= x0 && year <= end;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect(); const sx = ((e.clientX - r.left) / r.width) * W;
    const t = clamp(x0 + ((sx - L) / (W - L - R)) * (x1 - x0), x0, end); setHv({ t, v: valAt(t) });
  };
  const tipX = hv ? clamp(X(hv.t), L + 44, W - R - 44) : 0;
  return (
    <figure className="mt-4">
      <figcaption className="flex items-baseline justify-between"><span className="text-[10.5px] font-semibold text-[#7a6650] caps">{title}</span><span className="text-[11.5px] italic text-[#8a7862]">{unit}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block w-full touch-none" onPointerMove={onMove} onPointerLeave={() => setHv(null)} role="img" aria-label={`${title}, ${x0} to ${end}`}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#e3d8c2" strokeWidth={1} />
            <text x={L - 5} y={Y(v) + 3.5} textAnchor="end" fontSize={10} fill="#8a7862" className="num">{tickFmt(v)}</text>
          </g>
        ))}
        {xTicks.map((t) => <text key={t} x={X(t)} y={H - 5} textAnchor="middle" fontSize={10} fill="#8a7862" className="num">{t}</text>)}
        <path d={area} fill="#34507a" fillOpacity={0.08} />
        <path d={d} fill="none" stroke="#34507a" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {notes.map(([t, label, below]) => <text key={label} x={X(t)} y={Y(valAt(t)) + (below ? 15 : -7)} textAnchor="middle" fontSize={9.5} fontStyle="italic" fill="#6e604f">{label}</text>)}
        {showYear && (
          <g pointerEvents="none">
            <line x1={X(year)} x2={X(year)} y1={T - 4} y2={H - B} stroke="#8a3b22" strokeWidth={1.2} />
            <circle cx={X(year)} cy={Y(valAt(year))} r={4} fill="#8a3b22" stroke="#fbf8f1" strokeWidth={2} />
          </g>
        )}
        {hv && (
          <g pointerEvents="none">
            <line x1={X(hv.t)} x2={X(hv.t)} y1={T} y2={H - B} stroke="#3a3026" strokeWidth={1} strokeDasharray="2 2" />
            <circle cx={X(hv.t)} cy={Y(hv.v)} r={3.5} fill="#34507a" stroke="#fbf8f1" strokeWidth={1.5} />
            <rect x={tipX - 42} y={1} width={84} height={28} rx={3} fill="#fbf8f1" stroke="#bfae8c" />
            <text x={tipX} y={12} textAnchor="middle" fontSize={9.5} fill="#7a6650" className="num">{Math.floor(hv.t)}</text>
            <text x={tipX} y={25} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#2b2119" className="num">{fmt(hv.v)}</text>
          </g>
        )}
      </svg>
    </figure>
  );
}

/* Collapsible map box, like the legend: the Company in London — stock, dividend, army, Parliament. */
function LondonBox({ year, open, onToggle, maxH }) {
  const bodyRef = useRef(null);
  const stock = year <= STOCK[STOCK.length - 1][0] ? lerpSeries(STOCK, year) : null;
  const div = stepSeries(DIVIDEND, year), army = stepSeries(ARMY, year);
  const lastIdx = LONDON.filter((x) => x.at <= year).length - 1;
  const latest = LONDON[lastIdx];
  const fresh = latest && year - latest.at < 1.5;
  useEffect(() => { // keep the current Parliament entry in view as the story advances
    const box = bodyRef.current; if (!open || !box) return;
    const el = box.querySelector('[data-current="1"]');
    if (el) box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight / 2), behavior: 'smooth' });
  }, [open, lastIdx]);
  return (
    <div className="flex flex-col rounded-md border border-[#cdbf9f] bg-[#fbf8f1]/95 shadow-sm" style={{ maxHeight: maxH }}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full shrink-0 items-center justify-between gap-3 px-3 py-1.5 text-[11px] font-semibold text-[#6e5a44] caps">
        <span className="flex items-center gap-1.5">
          <Landmark size={12} />London
          <span className="num text-[11.5px] font-normal normal-case tracking-normal text-[#8a7862]">· {Math.floor(year)}</span>
          {fresh && !open && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#8a3b22]" title="New in London" />}
        </span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {!open && fresh && (
        <button onClick={onToggle} className="border-t border-[#e3d8c2] px-3 py-1.5 text-left text-[12.5px] leading-snug text-[#3a3026] hover:bg-[#f3ecdd]">
          <span className="num mr-1 italic text-[#8a3b22]">{fmtMonth(latest.at)}</span>{latest.t}
        </button>
      )}
      {open && (
        <div ref={bodyRef} className="thin-scroll relative min-h-0 overflow-y-auto border-t border-[#e3d8c2] px-3 pb-3 pt-2">
          <div className="text-[10.5px] font-semibold text-[#8a3b22] caps">Parliament & Leadenhall Street</div>
          <p className="mt-1 text-[13px] leading-snug text-[#4a3d30]">The Company was run from East India House by 24 directors elected by its shareholders. From 1767 Parliament took an ever larger hand in its affairs.</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[['Stock', stock ? `£${Math.round(stock)}` : '—', stock ? 'per £100' : 'to 1805'], ['Dividend', `${div}%`, 'a year'], ['Army', `${Math.round(army / 1000)}k`, 'men']].map(([l, v, sub]) => (
              <div key={l} className="min-w-0 rounded border border-[#e0d4bb] bg-[#fffdf7] px-2 py-1.5">
                <div className="text-[9.5px] font-semibold text-[#8a7862] caps">{l}</div>
                <div className="display num text-[20px] font-semibold leading-tight text-[#2b2119]">{v}</div>
                <div className="text-[10.5px] leading-tight text-[#8a7862]">{sub}</div>
              </div>
            ))}
          </div>
          <MiniChart title="East India stock" unit="£ per £100 of stock" data={STOCK} x0={1739} x1={1805} yMin={100} yMax={300} yTicks={[100, 200, 300]} xTicks={[1740, 1760, 1780, 1800]}
            year={year} fmt={(v) => `£${Math.round(v)}`} notes={[[1768, 'Diwani boom'], [1773.4, 'crash of 1772–73', 1], [1783, "Fox's India Bill", 1]]} />
          <MiniChart title="Company armies in India" unit="men under arms" data={ARMY} step x0={1739} x1={1858} yMin={0} yMax={300000} yTicks={[0, 100000, 200000, 300000]} xTicks={[1740, 1780, 1820, 1858]}
            year={year} fmt={(v) => Math.round(v).toLocaleString('en-GB')} tickFmt={(v) => (v ? `${v / 1000}k` : '0')} />
          <p className="mt-1.5 text-[11px] italic leading-snug text-[#8a7862]">Indicative figures, rounded from secondary sources. The shape of the stock series is well documented; individual values are approximate.</p>
          <div className="mb-1.5 mt-3 border-b border-[#d9ccb2] pb-1 text-[10.5px] font-semibold text-[#7a6650] caps">Parliament & the Company</div>
          <ol className="flex flex-col gap-1.5">
            {LONDON.map((x, i) => (
              <li key={i} data-current={i === lastIdx ? '1' : undefined}
                className={`grid grid-cols-[54px_1fr] gap-1.5 rounded px-1 py-0.5 text-[12.5px] leading-snug ${i === lastIdx ? 'bg-[#efe6d3]' : ''} ${x.at > year ? 'text-[#a8977c]' : 'text-[#2f251c]'}`}>
                <span className={`num pt-px text-[11px] italic ${i === lastIdx ? 'font-semibold text-[#8a3b22]' : 'text-[#8a7862]'}`}>{fmtMonth(x.at)}</span>
                <span>{x.t}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function holdersAt(office, t) { return office.holders.filter(([a, b]) => t >= a && t < b); }

function LeadersList({ t, factions }) {
  const groups = factions.map((f) => ({ f, offices: OFFICES.filter((o) => o.f === f).map((o) => ({ o, hs: holdersAt(o, t) })).filter((x) => x.hs.length) })).filter((g) => g.offices.length);
  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ f, offices }) => (
        <div key={f} className="rounded-md border border-[#e0d4bb] bg-[#fbf8f1]/70 px-3 py-2">
          <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-[#5d4d3c] caps"><FactionDot f={f} size={9} />{FACTIONS[f].name}</div>
          {offices.map(({ o, hs }) => (
            <div key={o.title} className="mt-1.5">
              <div className="text-[11px] italic text-[#8a7862]">{o.title}</div>
              {hs.map(([, , name, note], i) => (
                <div key={i} className="text-[14.5px] leading-snug text-[#2f251c]">
                  <span className="font-medium">{name}</span>{note ? <span className="text-[12.5px] text-[#7a6a57]"> · {note}</span> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TerritoryShare({ t, vis }) {
  const G = geo();
  const totals = {}; let sum = 0;
  for (const id of Object.keys(REGIONS)) {
    if (SUBCONTINENT_EXCLUDE.has(id) || !G.regions[id]) continue;
    const st = regionState(id, t); const a = G.regions[id].area;
    totals[st.f] = (totals[st.f] || 0) + a; sum += a;
  }
  const order = [...ALL_FORCES, 'crown', 'other'].filter((f) => totals[f]);
  const raj = t >= RAJ;
  const eicPct = Math.round((((raj ? totals.crown : totals.eic) || 0) / sum) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px] text-[#7a6650] caps">
        <span>Share of the subcontinent</span>
        <span className="num normal-case tracking-normal text-[13px] font-semibold" style={{ color: FACTIONS[raj ? 'crown' : 'eic'].ink }}>{raj ? 'British Raj' : 'Company'} {eicPct < 1 ? '<1' : eicPct}%</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-sm border border-[#d6c8aa]">
        {order.map((f) => (
          <div key={f} title={`${FACTIONS[f].name}: ${Math.round((totals[f] / sum) * 100)}%`} className="h-full transition-all duration-1000"
            style={{ width: `${(totals[f] / sum) * 100}%`, background: vis.includes(f) || f === 'other' ? FACTIONS[f].color : MUTED }} />
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   14 · MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */

export default function EICMap() {
  const G = geo();
  const [mode, setMode] = useState('all');
  const [focus, setFocus] = useState('eic');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [, setFrame] = useState(0);
  const [tab, setTab] = useState('event');
  const [selection, setSelection] = useState(null);
  const [hover, setHover] = useState(null);
  const [closedCallout, setClosedCallout] = useState(null);
  const [follow, setFollow] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1280);
  const [londonOpen, setLondonOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1440);
  const [tlHover, setTlHover] = useState(null);
  const [showTrade, setShowTrade] = useState(true);
  const svgRef = useRef(null);
  const mapBoxRef = useRef(null);
  const trackRef = useRef(null);
  const bump = useCallback(() => setFrame((f) => (f + 1) % 1e9), []);
  const [box, setBox] = useState({ w: 1000, h: 800 });
  useEffect(() => {
    const el = mapBoxRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width || 1, h: e.contentRect.height || 1 }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const vis = useMemo(() => { const base = mode === 'all' ? ALL_FORCES : mode === 'main' ? MAIN : [focus]; return base.includes('eic') ? [...base, 'crown'] : base; }, [mode, focus]);
  const events = useMemo(() => G.events.filter((e) => mode === 'all' || e.f.some((f) => vis.includes(f))), [G, mode, vis]);
  const clock = useMemo(() => buildClock(events), [events]);

  const S = useRef(null);
  if (!S.current) S.current = { tau: 0, year: T0, playing: true, speed: 1, follow: true, cam: { x: G.W / 2, y: G.H / 2, z: 1 }, camTarget: null, activeIdx: -2, activatedAt: 0, drag: null, moved: false, clock: null, events: null, vis };
  const st = S.current;
  // Re-map the playhead when the filter changes the event list, preserving the historical date.
  if (st.clock !== clock) {
    if (st.clock) st.tau = tauForYear(clock, st.year);
    st.clock = clock; st.events = events; st.activeIdx = -2;
  }
  st.vis = vis; st.box = box;

  const cameraFor = useCallback((ev) => {
    if (!ev) return { x: G.W / 2, y: G.H / 2, z: 1 };
    const pts = [ev.xy];
    for (const m of ev.moves) if (S.current.vis.includes(m.f) || mode === 'all') for (let i = 0; i < m.pts.length; i += 4) pts.push(m.pts[i]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const w = Math.max(x1 - x0 + 150, 330), h = Math.max(y1 - y0 + 150, 300);
    const z = clamp(Math.min(G.W / w, G.H / h), 1, 2.7);
    // Pivotal events open a card in the top-left corner: nudge the view so the action sits clear of it.
    const b = S.current.box, nudge = ev.pv && b && b.w < 1300 ? 1 : 0;
    return { x: (x0 + x1) / 2 - nudge * (G.W / z) * 0.14, y: (y0 + y1) / 2 + 8 - nudge * (G.H / z) * 0.12, z };
  }, [G, mode]);

  /* Keep the view on the map: at most a small margin of paper past any edge, and never zoomed out past the whole map. */
  const clampCam = useCallback((c) => {
    const b = S.current.box || { w: 1000, h: 800 };
    const z = clamp(c.z, 1, 7), vbW = G.W / z, vbH = G.H / z, kk = Math.min(b.w / vbW, b.h / vbH);
    const visW = b.w / kk, visH = b.h / kk, m = 24;
    const fit = (v, vis, size) => (vis >= size + 2 * m ? size / 2 : clamp(v, vis / 2 - m, size - vis / 2 + m));
    return { x: fit(c.x, visW, G.W), y: fit(c.y, visH, G.H), z };
  }, [G]);

  const syncActive = useCallback((now) => {
    const s = S.current;
    const info = clockAt(s.clock, s.tau);
    s.year = info.t;
    if (info.idx !== s.activeIdx) {
      s.activeIdx = info.idx; s.activatedAt = now;
      s.camTarget = cameraFor(s.events[info.idx]);
    }
    return info;
  }, [cameraFor]);

  // Animation loop
  useEffect(() => {
    let raf, last = performance.now();
    const tick = (now) => {
      const s = S.current, dt = Math.min(0.1, (now - last) / 1000); last = now;
      let changed = false;
      if (s.playing && !s.scrubbing) {
        s.tau += dt * s.speed;
        if (s.tau >= s.clock.total) { s.tau = s.clock.total; s.playing = false; setPlaying(false); }
        changed = true;
      }
      syncActive(now);
      if (s.follow && s.camTarget && !s.drag) {
        const c = s.cam, g = clampCam(s.camTarget), k = 1 - Math.exp(-dt * 1.9);
        if (Math.abs(g.x - c.x) + Math.abs(g.y - c.y) > 0.3 || Math.abs(g.z - c.z) > 0.002) {
          c.x += (g.x - c.x) * k; c.y += (g.y - c.y) * k; c.z += (g.z - c.z) * k; changed = true;
        }
      }
      if (now - s.activatedAt < 4200 || (s.events[s.activeIdx] && s.events[s.activeIdx].pays.length)) changed = true;
      if (changed) bump();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bump, syncActive, clampCam]);

  const setPlay = useCallback((v) => {
    const s = S.current;
    if (v && s.tau >= s.clock.total - 0.01) { s.tau = 0; s.activeIdx = -2; }
    s.playing = v; setPlaying(v);
  }, []);
  const setSpd = (v) => { S.current.speed = v; setSpeed(v); };
  const setFollowBoth = useCallback((v) => {
    S.current.follow = v; setFollow(v);
    if (v) S.current.camTarget = cameraFor(S.current.events[S.current.activeIdx]);
  }, [cameraFor]);

  const seekEvent = useCallback((i) => {
    const s = S.current; if (!s.clock.segs[i]) return;
    s.tau = s.clock.segs[i].b + 0.001; s.activeIdx = -2;
    syncActive(performance.now()); setClosedCallout(null); setTab('event'); bump();
  }, [syncActive, bump]);
  const seekYear = useCallback((t) => {
    const s = S.current; s.tau = tauForYear(s.clock, clamp(t, T0, T1)); syncActive(performance.now()); bump();
  }, [syncActive, bump]);

  // Derived per-frame values
  const info = clockAt(clock, st.tau);
  const year = info.t;
  const active = events[info.idx] || null;
  const moveP = active ? clamp((performance.now() - st.activatedAt) / (3600 / Math.max(1, speed * 0.8)), 0, 1) : 0;
  const cam = st.cam;
  const vbW = G.W / cam.z, vbH = G.H / cam.z;
  const viewBox = `${(cam.x - vbW / 2).toFixed(2)} ${(cam.y - vbH / 2).toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}`;
  // k = screen pixels per map unit; used to keep markers and labels a constant on-screen size
  const k = Math.min(box.w / vbW, box.h / vbH);
  const kq = Math.round(k * 8);

  const goPrev = () => {
    const i = info.phase === 'dwell' && info.f > 0.2 ? info.idx : info.idx - 1;
    seekEvent(Math.max(0, i));
  };
  const goNext = () => seekEvent(Math.min(events.length - 1, info.idx + 1));

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); setPlay(!S.current.playing); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); const i = clockAt(S.current.clock, S.current.tau).idx; seekEvent(Math.min(S.current.events.length - 1, i + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); const inf = clockAt(S.current.clock, S.current.tau); seekEvent(Math.max(0, inf.phase === 'dwell' && inf.f > 0.2 ? inf.idx : inf.idx - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPlay, seekEvent]);

  // map zoom / pan
  const toSvg = (cx, cy) => {
    const el = svgRef.current; const p = el.createSVGPoint(); p.x = cx; p.y = cy;
    return p.matrixTransform(el.getScreenCTM().inverse());
  };
  const zoomAt = useCallback((cx, cy, factor) => {
    const s = S.current, el = svgRef.current; if (!el) return;
    let pt;
    if (cx == null) pt = { x: s.cam.x, y: s.cam.y };
    else { const p = el.createSVGPoint(); p.x = cx; p.y = cy; pt = p.matrixTransform(el.getScreenCTM().inverse()); }
    const z = clamp(s.cam.z * factor, 1, 7);
    s.cam = clampCam({ x: pt.x - (pt.x - s.cam.x) * (s.cam.z / z), y: pt.y - (pt.y - s.cam.y) * (s.cam.z / z), z });
    setFollowBoth(false); bump();
  }, [bump, setFollowBoth, clampCam]);
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const s = S.current; s.drag = { x: e.clientX, y: e.clientY, cx: s.cam.x, cy: s.cam.y, id: e.pointerId }; s.moved = false;
  };
  const onPointerMove = (e) => {
    const s = S.current;
    if (s.drag) {
      const dx = e.clientX - s.drag.x, dy = e.clientY - s.drag.y;
      if (!s.moved && Math.hypot(dx, dy) > 4) { s.moved = true; svgRef.current.setPointerCapture?.(s.drag.id); setFollowBoth(false); setHover(null); }
      if (s.moved) {
        const sc = svgRef.current.getScreenCTM().a;
        s.cam = clampCam({ x: s.drag.cx - dx / sc, y: s.drag.cy - dy / sc, z: s.cam.z }); bump();
        return;
      }
    }
    const id = e.target?.dataset?.region;
    const box = mapBoxRef.current.getBoundingClientRect();
    if (id) setHover({ kind: 'region', id, x: e.clientX - box.left, y: e.clientY - box.top });
    else if (e.target?.dataset?.place) setHover({ kind: 'place', id: e.target.dataset.place, x: e.clientX - box.left, y: e.clientY - box.top });
    else if (hover) setHover(null);
  };
  const onPointerUp = (e) => {
    const s = S.current; const wasDrag = s.moved; s.drag = null;
    if (wasDrag) { s.moved = false; return; }
    const id = e.target?.dataset?.region, pl = e.target?.dataset?.place;
    if (id) { setSelection({ kind: 'region', id }); setTab('place'); setSheetOpen(true); }
    else if (pl) { setSelection({ kind: 'place', id: pl }); setTab('place'); setSheetOpen(true); }
  };

  // Territory state keys (re-render fills only when control changes)
  const states = {};
  for (const id of Object.keys(REGIONS)) states[id] = regionState(id, year);
  const stateKey = JSON.stringify(states);
  const visKey = JSON.stringify(vis);

  // Regions that change hands around the active event get a flashing outline
  const changed = useMemo(() => {
    if (!active) return [];
    return Object.keys(REGIONS).filter((id) => REGIONS[id].ctl.some((c, i) => i > 0 && c[0] >= active.t - 0.03 && c[0] <= active.t + 0.12));
  }, [active]);

  const recent = events.slice(Math.max(0, info.idx - 2), Math.max(0, info.idx)).filter((e) => year - e.t < 3);
  const past = events.slice(0, Math.max(0, info.idx));
  const era = eraAt(year);
  const showCallout = active && active.pv && closedCallout !== active.id && info.phase === 'dwell' && !(sheetOpen && box.w < 1024);
  const legendFactions = mode === 'single' ? [focus] : vis;

  /* ── render ── */
  return (
    <div className="atlas relative flex w-full flex-col overflow-hidden" style={{ height: '100%', minHeight: 560 }}>
      <style>{CSS}</style>

      {/* HEADER */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[#d6c8aa] bg-[#f3ecdd] px-4 py-2.5 sm:px-6">
        <div className="min-w-0">
          <div className="display flex items-baseline gap-3">
            <h1 className="text-[24px] font-semibold leading-none tracking-[0.18em] text-[#2b2119] sm:text-[28px]">THE ANARCHY</h1>
            <span className="hidden text-[15px] italic text-[#7a6650] md:inline">an atlas of the East India Company's rise, 1739–1803</span>
          </div>
          <div className="mt-0.5 text-[12px] text-[#8a7862]">After William Dalrymple, <i>The Anarchy: The Relentless Rise of the East India Company</i></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-[#cdbf9f] bg-[#fbf8f1] p-0.5 text-[13px]" role="tablist" aria-label="Filter forces">
            {[['all', 'All forces'], ['main', 'Main forces'], ['single', 'Single force']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                className={`rounded px-2.5 py-1 transition-colors ${mode === k ? 'bg-[#3a3026] text-[#f7f3ea]' : 'text-[#5d4d3c] hover:bg-[#efe6d3]'}`}>{label}</button>
            ))}
          </div>
          {mode === 'single' && (
            <div className="flex max-w-full flex-wrap gap-1">
              {ALL_FORCES.map((f) => (
                <button key={f} onClick={() => setFocus(f)} title={FACTIONS[f].name}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] transition-colors ${focus === f ? 'border-[#3a3026] bg-[#3a3026] text-[#f7f3ea]' : 'border-[#d6c8aa] bg-[#fbf8f1] text-[#4a3d30] hover:bg-[#efe6d3]'}`}>
                  <FactionDot f={f} size={8} />{FACTIONS[f].short}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* BODY */}
      <div className="relative flex min-h-0 flex-1">
        {/* MAP */}
        <div ref={mapBoxRef} className="paper-bg relative min-w-0 flex-1 overflow-hidden" onPointerLeave={() => setHover(null)}>
          <div className="mottle pointer-events-none absolute inset-0" />
          <svg ref={svgRef} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full touch-none select-none"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} role="img" aria-label={`Map of India in ${Math.floor(year)}`}>
            <defs>
              {Object.entries(FACTIONS).map(([k, c]) => (
                <pattern key={k} id={`hatch-${k}`} width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
                  <line x1="0" y1="0" x2="0" y2="4.5" stroke={c.ink} strokeWidth="1.15" strokeOpacity=".5" />
                </pattern>
              ))}
              {[['l', 0, 0, 1, 0], ['r', 1, 0, 0, 0], ['t', 0, 0, 0, 1], ['b', 0, 1, 0, 0]].map(([id, x1, y1, x2, y2]) => (
                <linearGradient key={id} id={`mist-${id}`} x1={x1} y1={y1} x2={x2} y2={y2}>
                  <stop offset="0" stopColor={PAPER} stopOpacity="1" /><stop offset=".45" stopColor={PAPER} stopOpacity=".7" /><stop offset="1" stopColor={PAPER} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            <rect x={-2000} y={-2000} width={G.W + 4000} height={G.H + 4000} fill="transparent" />
            <SeaAndLand />
            <Territories stateKey={stateKey} visKey={visKey} />
            <Relief />
            <Borders />
            <Labels kq={kq} />

            {/* changed-hands highlight */}
            {changed.map((id) => {
              const r = G.regions[id]; if (!r) return null;
              const f = states[id].f; const c = FACTIONS[f];
              if (!vis.includes(f) && f !== 'other') return null;
              return <path key={id} d={r.d} fill="none" stroke={c.ink} strokeWidth={2.4} className="atl-flash" pointerEvents="none" {...NS} />;
            })}
            {/* hover highlight */}
            {hover?.kind === 'region' && G.regions[hover.id] && (
              <path d={G.regions[hover.id].d} fill="#fffaf0" fillOpacity={0.18} stroke="#2f251c" strokeWidth={1.6} pointerEvents="none" {...NS} />
            )}

            {/* campaign trails from the previous events */}
            {recent.map((e) => e.moves.filter((m) => mode === 'all' || vis.includes(m.f)).map((m, i) => <MoveLine key={e.id + i} mv={m} p={1} z={k} faded />))}

            {/* history dots */}
            {past.map((e, i) => {
              const f = e.f.find((x) => vis.includes(x)) || e.f[0];
              return (
                <circle key={e.id} cx={e.xy[0]} cy={e.xy[1]} r={(e.pv ? 3.6 : 2.6) / k} fill={FACTIONS[f].color} stroke={FACTIONS[f].ink} strokeWidth={0.8}
                  opacity={0.75} style={{ cursor: 'pointer' }} {...NS} onClick={(ev) => { ev.stopPropagation(); seekEvent(i); }}>
                  <title>{`${fmtDate(e.d)} · ${e.title}`}</title>
                </circle>
              );
            })}

            {/* enclaves */}
            {Object.values(G.enclaves).map((en, i) => {
              const f = enclaveState(en.id, year); const shown = vis.includes(f) || f === 'other'; const c = FACTIONS[f];
              const s = 6 / Math.pow(k, 0.6);
              return (
                <path key={en.id} d={BLOBS[i % BLOBS.length]} transform={`translate(${en.xy[0]} ${en.xy[1]}) scale(${s})`}
                  style={{ fill: shown ? c.color : MUTED, transition: 'fill 1s' }} stroke={shown ? c.ink : '#a8977c'} strokeWidth={1} {...NS}>
                  <title>{`${en.name} — ${FACTIONS[f].name}`}</title>
                </path>
              );
            })}

            {/* ambient Company shipping lanes; the ships sail while the atlas plays */}
            {showTrade && vis.includes('eic') && G.lanes.filter((l) => year >= l.from).map((l, i) => {
              const { head } = partial(l.pts, l.L, (st.tau * 0.028 + i * 0.37) % 1);
              return (
                <g key={l.name} pointerEvents="none">
                  <path d={l.d} fill="none" stroke="#5f7f91" strokeOpacity={0.4} strokeWidth={0.9} strokeDasharray="1 4" strokeLinecap="round" {...NS} />
                  <g transform={`translate(${head[0]} ${head[1]}) scale(${0.75 / k})`} opacity={0.85}><UnitGlyph unit="merchant" c={FACTIONS[year >= RAJ ? 'crown' : 'eic']} /></g>
                </g>
              );
            })}

            {/* mist: the map dissolves into the paper instead of ending at a hard edge */}
            <g pointerEvents="none">
              <path fillRule="evenodd" fill={PAPER} d={`M-3000,-3000H${G.W + 3000}V${G.H + 3000}H-3000Z M-38,-38V${G.H + 38}H${G.W + 38}V-38Z`} />
              <rect x={-38} y={-38} width={120} height={G.H + 76} fill="url(#mist-l)" />
              <rect x={G.W - 82} y={-38} width={120} height={G.H + 76} fill="url(#mist-r)" />
              <rect x={-38} y={-38} width={G.W + 76} height={100} fill="url(#mist-t)" />
              <rect x={-38} y={G.H - 34} width={G.W + 76} height={72} fill="url(#mist-b)" />
            </g>

            {/* cities */}
            {Object.values(G.places).map((pl) => {
              const isActive = active && active.p === pl.id;
              if (!pl.major && !isActive && k < 2) return null;
              return (
                <g key={pl.id} transform={`translate(${pl.xy[0]} ${pl.xy[1]}) scale(${1 / k})`}>
                  <circle r={pl.major ? 2.6 : 2} fill="#2f251c" />
                  <circle r={7} fill="transparent" data-place={pl.id} style={{ cursor: 'pointer' }} />
                  {!isActive && (pl.major === 2 || k >= 0.8) && (
                    <text x={pl.left ? -5 : 5} y={3.4} textAnchor={pl.left ? 'end' : 'start'} fontSize={pl.major ? 10.5 : 9.5} className="display" fontWeight={600}
                      fill="#2f251c" letterSpacing="0.06em" style={{ paintOrder: 'stroke', stroke: 'rgba(247,243,234,.85)', strokeWidth: 3, strokeLinejoin: 'round' }} pointerEvents="none">
                      {pl.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* active movements & marker */}
            {active && active.moves.filter((m) => mode === 'all' || vis.includes(m.f) || m.f === 'other').map((m, i) => (
              <MoveLine key={active.id + i} mv={m} p={clamp(moveP * 1.15 - i * 0.08, 0, 1)} z={k} />
            ))}
            {active && active.pays.map((q, i) => <PaymentFlow key={active.id + 'p' + i} pay={q} idx={i} z={k} secs={(performance.now() - st.activatedAt) / 1000} />)}
            {active && <EventMarker ev={active} z={k} onClick={() => { setTab('event'); setSheetOpen(true); }} />}
          </svg>
          <div className="mist pointer-events-none absolute inset-0" />
          <div className="grain pointer-events-none absolute inset-0" />

          {/* Cartouche */}
          <div className="pointer-events-none absolute right-3 top-3 text-right transition-opacity duration-500 sm:right-6 sm:top-5" style={{ marginRight: 'env(safe-area-inset-right, 0px)', opacity: showCallout && box.w < 1000 ? 0 : 1 }}>
            <div className="display num text-[26px] font-medium leading-none tracking-[0.12em] text-[#2b2119] sm:text-[40px]">{year >= RAJ ? <>BRITISH INDIA, {Math.floor(year)}</> : <>HINDUSTAN, <span className="italic">c.</span> {Math.floor(year)}</>}</div>
            <div className="ml-auto mt-2 h-px w-48 bg-[#9c8a6e] sm:w-80" />
            <div className="mt-1.5 text-[13px] text-[#5d4d3c] sm:text-[16px]"><span className="italic">{era.title}</span> <span className="hidden sm:inline">· {era.sub}</span></div>
          </div>

          {/* Pivotal callout */}
          {showCallout && (
            <div key={active.id} className="atl-pop absolute left-3 top-3 z-10 w-[min(440px,calc(100%-24px))] sm:left-5 sm:top-5">
              <div className="relative rounded-[3px] border border-[#8f7b5c] bg-[#fbf8f1]/95 p-1 shadow-[0_10px_30px_-12px_rgba(60,40,20,.45)]">
                <div className="rounded-[2px] border border-[#cdbd9c] px-4 pb-3.5 pt-3">
                  <button onClick={() => setClosedCallout(active.id)} className="absolute right-2.5 top-2.5 rounded p-1 text-[#8a7862] hover:bg-[#efe6d3]" aria-label="Close callout"><X size={15} /></button>
                  <div className="flex items-center gap-2 text-[10.5px] font-semibold text-[#8a3b22] caps"><span>✦</span>Pivotal moment<span>✦</span></div>
                  <div className="display mt-1 text-[27px] font-semibold leading-[1.05] text-[#2b2119] sm:text-[31px]" style={{ textWrap: 'balance' }}>{active.title}</div>
                  <div className="mt-1 text-[14px] italic text-[#6e604f]">{fmtDate(active.d)}{active.pname ? ` · ${active.pname}` : ''}</div>
                  {active.forces && active.forces.length > 1 && box.w >= 560 && <div className="mt-3"><ForcesBlock forces={active.forces} /></div>}
                  {active.out && <p className="mt-3 border-t border-[#e0d4bb] pt-2 text-[15px] leading-snug text-[#3a3026]">{active.out}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Map controls */}
          <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5 sm:bottom-5 sm:right-5 sm:flex-row">
            {[
              { icon: Plus, label: 'Zoom in', on: () => zoomAt(null, null, 1.35) },
              { icon: Minus, label: 'Zoom out', on: () => zoomAt(null, null, 1 / 1.35) },
              { icon: RotateCcw, label: 'Whole map', on: () => { S.current.cam = { x: G.W / 2, y: G.H / 2, z: 1 }; setFollowBoth(false); bump(); } },
            ].map(({ icon: I, label, on }) => (
              <button key={label} onClick={on} title={label} aria-label={label}
                className="grid h-9 w-9 place-items-center rounded-md border border-[#cdbf9f] bg-[#fbf8f1]/95 text-[#4a3d30] shadow-sm hover:bg-[#efe6d3]"><I size={16} /></button>
            ))}
            <button onClick={() => setShowTrade(!showTrade)} title="Company shipping lanes" aria-label="Company shipping lanes" aria-pressed={showTrade}
              className={`grid h-9 w-9 place-items-center rounded-md border shadow-sm ${showTrade ? 'border-[#3a3026] bg-[#3a3026] text-[#f7f3ea]' : 'border-[#cdbf9f] bg-[#fbf8f1]/95 text-[#4a3d30] hover:bg-[#efe6d3]'}`}><Sailboat size={16} /></button>
            <button onClick={() => setFollowBoth(!follow)} title="Follow the action" aria-pressed={follow}
              className={`grid h-9 w-9 place-items-center rounded-md border shadow-sm ${follow ? 'border-[#3a3026] bg-[#3a3026] text-[#f7f3ea]' : 'border-[#cdbf9f] bg-[#fbf8f1]/95 text-[#4a3d30] hover:bg-[#efe6d3]'}`}><LocateFixed size={16} /></button>
          </div>

          {/* London box (top right, under the cartouche) */}
          <div className="absolute right-3 top-[84px] z-[9] w-[min(300px,calc(100%-24px))] sm:right-5 sm:top-[118px]">
            <LondonBox year={year} open={londonOpen} onToggle={() => setLondonOpen(!londonOpen)}
              maxH={Math.max(120, box.w < 640 ? box.h - 84 - 300 : box.h - 118 - 76)} />
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-80px)] sm:bottom-5 sm:left-5">
            <div className="rounded-md border border-[#cdbf9f] bg-[#fbf8f1]/95 shadow-sm">
              <button onClick={() => setLegendOpen(!legendOpen)} className="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-[11px] font-semibold text-[#6e5a44] caps">
                <span className="flex items-center gap-1.5"><Layers size={12} />Legend</span>{legendOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              </button>
              {legendOpen && (
                <div className="border-t border-[#e3d8c2] px-3 pb-2.5 pt-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {[...(mode === 'all' ? ALL_FORCES : legendFactions.filter((f) => f !== 'crown')), ...(vis.includes('crown') && year >= 1802 ? ['crown'] : [])].map((f) => (
                      <button key={f} onClick={() => { setMode('single'); setFocus(f === 'crown' ? 'eic' : f); }} title={`Focus on ${FACTIONS[f].name}`}
                        className="flex items-center gap-2 text-left text-[12.5px] text-[#3a3026] hover:underline">
                        <span className="inline-block h-3 w-4 rounded-[2px]" style={{ background: FACTIONS[f].color, boxShadow: `inset 0 0 0 1px ${FACTIONS[f].ink}` }} />{FACTIONS[f].short}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 hidden gap-x-4 gap-y-1 border-t border-[#e3d8c2] pt-2 text-[11.5px] text-[#5d4d3c] sm:grid sm:grid-cols-2">
                    <span className="flex items-center gap-2"><svg width="16" height="12"><rect width="16" height="12" fill="#e6dcc8" /><path d="M-2,10 L6,-2 M3,14 L13,-2 M9,14 L19,0" stroke="#34507a" strokeWidth="1.2" strokeOpacity=".6" /></svg>Protectorate of</span>
                    <span className="flex items-center gap-2"><svg width="18" height="10"><path d="M1,5 H17" stroke="#34507a" strokeWidth="1.8" strokeDasharray="5 3" /></svg>March</span>
                    <span className="flex items-center gap-2"><svg width="18" height="10"><path d="M1,5 H17" stroke="#34507a" strokeWidth="1.8" strokeDasharray="1.5 3" strokeLinecap="round" /></svg>Sea voyage</span>
                    <span className="flex items-center gap-2"><svg width="14" height="14"><circle cx="7" cy="7" r="4" fill="#7790b4" stroke="#34507a" /></svg>Past event</span>
                  </div>
                  <div className="mt-2 hidden border-t border-[#e3d8c2] pt-2 sm:block">
                    <div className="mb-1 text-[10px] font-semibold text-[#8a7862] caps">On the move</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {Object.entries(UNITS).map(([u, m]) => (
                        <span key={u} className="flex items-center gap-1.5 text-[11.5px] text-[#4a3d30]" title={m.note}><GlyphSwatch unit={u} size={19} />{m.label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hover tooltip */}
          {hover && (() => {
            let body = null;
            if (hover.kind === 'region') {
              const s = states[hover.id]; const info2 = REGIONS[hover.id];
              body = (<>
                <div className="display text-[16px] font-semibold leading-tight text-[#2b2119]">{info2.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#3a3026]"><FactionDot f={s.f} size={8} />{s.note || FACTIONS[s.f].name}</div>
                {s.over && <div className="mt-0.5 flex items-center gap-1.5 text-[12px] italic text-[#6e604f]"><FactionDot f={s.over} size={7} />under {FACTIONS[s.over].name}</div>}
              </>);
            } else {
              const pl = G.places[hover.id]; const n = G.events.filter((e) => e.p === hover.id).length;
              body = (<>
                <div className="display text-[16px] font-semibold leading-tight text-[#2b2119]">{pl.name}</div>
                <div className="text-[12px] italic text-[#6e604f]">{n ? `${n} event${n > 1 ? 's' : ''} here · click for details` : 'Click for details'}</div>
              </>);
            }
            const box = mapBoxRef.current?.getBoundingClientRect();
            const left = Math.min(hover.x + 14, (box?.width || 600) - 230);
            return <div className="pointer-events-none absolute z-30 w-[220px] rounded border border-[#bfae8c] bg-[#fbf8f1]/95 px-2.5 py-1.5 shadow-md" style={{ left, top: hover.y + 14 }}>{body}</div>;
          })()}

          {/* Mobile: open panel */}
          <button onClick={() => setSheetOpen(true)} className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[#3a3026] bg-[#3a3026] px-4 py-1.5 text-[13px] text-[#f7f3ea] shadow-md lg:hidden">
            <span className="flex items-center gap-1.5"><BookOpen size={14} />Details</span>
          </button>
        </div>

        {/* SIDE PANEL */}
        <aside className={`thin-scroll z-20 flex flex-col border-l border-[#d6c8aa] bg-[#f6f0e3] lg:static lg:flex lg:w-[390px] lg:translate-y-0 ${sheetOpen ? 'absolute inset-x-0 bottom-0 top-[18%] translate-y-0 rounded-t-xl shadow-[0_-12px_30px_-10px_rgba(50,35,20,.35)]' : 'absolute inset-x-0 bottom-0 top-[18%] translate-y-[110%]'} transition-transform duration-300`}>
          <div className="flex items-center gap-1 border-b border-[#d9ccb2] px-3 pt-2">
            {[['event', 'Event', BookOpen], ['leaders', 'Leaders', Users], ['place', 'Place', MapIcon]].map(([k, label, I]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13.5px] ${tab === k ? 'border-[#8a3b22] font-semibold text-[#2b2119]' : 'border-transparent text-[#7a6650] hover:text-[#3a3026]'}`}>
                <I size={14} />{label}
              </button>
            ))}
            <button onClick={() => setSheetOpen(false)} className="ml-auto rounded p-1.5 text-[#7a6650] hover:bg-[#efe6d3] lg:hidden" aria-label="Close panel"><X size={16} /></button>
          </div>

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
            {tab === 'event' && (active ? (
              <div key={active.id} className="atl-fade">
                <div className="text-[11px] font-semibold text-[#8a3b22] caps">{eraAt(active.t).title}</div>
                <div className="display mt-1 num text-[17px] italic text-[#6e604f]">{fmtDate(active.d)}{active.pname ? ` · ${active.pname}` : ''}</div>
                <h2 className="display mt-0.5 text-[30px] font-semibold leading-[1.05] text-[#2b2119]" style={{ textWrap: 'balance' }}>{active.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#3a3026] px-2 py-0.5 text-[11.5px] text-[#f7f3ea]">
                    {React.createElement(TYPE_META[active.ty].icon, { size: 12 })}{TYPE_META[active.ty].label}
                  </span>
                  {active.pv && <span className="rounded-full border border-[#8a3b22] px-2 py-0.5 text-[11.5px] text-[#8a3b22]">Pivotal</span>}
                  {active.f.filter((f) => f !== 'other').map((f) => <FactionChip key={f} f={f} />)}
                </div>
                <p className="mt-3 text-[16px] leading-[1.55] text-[#2f251c]">{active.sum}</p>
                {active.out && <p className="mt-3 border-l-2 border-[#8a3b22] pl-3 text-[15px] italic leading-snug text-[#4a3d30]">{active.out}</p>}
                {active.forces && (<><SectionTitle icon={Swords}>Forces engaged</SectionTitle><ForcesBlock forces={active.forces} /></>)}
                {active.lead && (<>
                  <SectionTitle icon={Crown}>Key figures</SectionTitle>
                  <ul className="flex flex-col gap-1.5">
                    {active.lead.map(([n, r, f]) => (
                      <li key={n + r} className="flex items-start gap-2 text-[15px] leading-snug"><span className="mt-1.5"><FactionDot f={f} size={8} /></span><span><span className="font-medium text-[#2b2119]">{n}</span> <span className="text-[13.5px] text-[#7a6a57]">· {r}</span></span></li>
                    ))}
                  </ul>
                </>)}
                {active.pays.length > 0 && (<>
                  <SectionTitle icon={Coins}>Money changing hands</SectionTitle>
                  <ul className="flex flex-col gap-2">
                    {active.pays.map((q, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14.5px] leading-snug">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#7a5a14] bg-[#e4c15a] text-[11px] font-bold text-[#5c420c]">{q.amt.includes('£') ? '£' : '₹'}</span>
                        <span><span className="num font-semibold text-[#2b2119]">{q.amt}</span> <span className="text-[13px] text-[#7a6a57]">· {q.fromName} → {q.toName}</span><span className="block text-[13.5px] text-[#4a3d30]">{q.what}</span></span>
                      </li>
                    ))}
                  </ul>
                </>)}
                {active.moves.length > 0 && (<>
                  <SectionTitle icon={Footprints}>On the move</SectionTitle>
                  <ul className="flex flex-col gap-1.5">
                    {active.moves.map((m, i) => {
                      const u = m.unit || (m.kind === 'naval' || m.kind === 'river' ? 'warship' : 'army');
                      return (
                        <li key={i} className="flex items-center gap-2.5 text-[14.5px] leading-snug">
                          <GlyphSwatch unit={u} f={m.f} size={26} />
                          <span><span className="font-medium text-[#2b2119]">{m.label || FACTIONS[m.f].name}</span> <span className="text-[13px] text-[#7a6a57]">· {UNITS[u].label}{m.kind === 'retreat' ? ', in retreat' : ''}</span></span>
                        </li>
                      );
                    })}
                  </ul>
                </>)}
                <SectionTitle icon={Users}>Leaders in play, {active.d.slice(0, 4)}</SectionTitle>
                <LeadersList t={active.t} factions={active.f.filter((f) => f !== 'other' && FACTIONS[f])} />
              </div>
            ) : (
              <div className="atl-fade">
                <div className="text-[11px] font-semibold text-[#8a3b22] caps">Prologue</div>
                <h2 className="display mt-1 text-[30px] font-semibold leading-[1.05] text-[#2b2119]">India, 1739</h2>
                <p className="mt-3 text-[16px] leading-[1.55] text-[#2f251c]">The Mughal Empire still rules, in name, from Kabul to Bengal. The English East India Company holds three fortified trading posts, at Bombay, Madras and Calcutta, and employs a few hundred European soldiers. Within sixty-five years it will rule most of the subcontinent.</p>
                <p className="mt-3 text-[15px] italic leading-snug text-[#5d4d3c]">The atlas plays automatically. Pause at any moment, drag the timeline, or click a region, city or past event for details.</p>
                <SectionTitle icon={Users}>Leaders in play, 1739</SectionTitle>
                <LeadersList t={T0 + 0.01} factions={vis} />
              </div>
            ))}

            {tab === 'leaders' && (
              <div className="atl-fade">
                <div className="text-[11px] font-semibold text-[#8a3b22] caps">{era.title}</div>
                <h2 className="display mt-1 text-[28px] font-semibold leading-tight text-[#2b2119]">Who ruled in {fmtMonth(year)}</h2>
                {mode === 'single' && <p className="mt-2 text-[14.5px] leading-snug text-[#4a3d30]">{FACTIONS[focus].blurb}</p>}
                <div className="mt-3"><LeadersList t={year} factions={vis} /></div>
              </div>
            )}

            {tab === 'place' && (selection ? (() => {
              if (selection.kind === 'region') {
                const info2 = REGIONS[selection.id]; const s = states[selection.id];
                const here = G.events.filter((e) => e.region === selection.id);
                return (
                  <div className="atl-fade">
                    <div className="text-[11px] font-semibold text-[#8a3b22] caps">Region</div>
                    <h2 className="display mt-1 text-[30px] font-semibold leading-tight text-[#2b2119]">{info2.name}</h2>
                    <div className="mt-2 flex items-center gap-2 text-[15px]"><FactionDot f={s.f} />{s.note || FACTIONS[s.f].name}</div>
                    {s.over && <div className="mt-1 flex items-center gap-2 text-[14px] italic text-[#6e604f]"><FactionDot f={s.over} size={8} />under the protection of the {FACTIONS[s.over].name}</div>}
                    <SectionTitle>Changes of hand</SectionTitle>
                    <ol className="flex flex-col gap-1.5">
                      {info2.ctl.map((c, i) => (
                        <li key={i} className="flex items-start gap-3 text-[14.5px]">
                          <span className="num w-11 shrink-0 text-right text-[#8a7862]">{Math.floor(c[0])}</span>
                          <span className="mt-1.5"><FactionDot f={c[1]} size={8} /></span>
                          <span className={c[0] <= year ? 'text-[#2b2119]' : 'text-[#a8977c]'}>{c[3] || FACTIONS[c[1]].name}{c[2] ? <i className="text-[#7a6a57]"> · under {FACTIONS[c[2]].short}</i> : null}</span>
                        </li>
                      ))}
                    </ol>
                    {here.length > 0 && <SectionTitle>Events here</SectionTitle>}
                    <EventLinks list={here} events={events} onSeek={seekEvent} year={year} />
                  </div>
                );
              }
              const pl = G.places[selection.id]; const here = G.events.filter((e) => e.p === selection.id);
              return (
                <div className="atl-fade">
                  <div className="text-[11px] font-semibold text-[#8a3b22] caps">City</div>
                  <h2 className="display mt-1 text-[30px] font-semibold leading-tight text-[#2b2119]">{pl.name}</h2>
                  <SectionTitle>Events here</SectionTitle>
                  {here.length ? <EventLinks list={here} events={events} onSeek={seekEvent} year={year} /> : <p className="text-[14.5px] italic text-[#6e604f]">No events are recorded at this place in the atlas.</p>}
                </div>
              );
            })() : (
              <p className="mt-4 text-[15px] italic text-[#6e604f]">Click any region or city on the map to see who held it, how it changed hands, and what happened there.</p>
            ))}
          </div>

          <div className="border-t border-[#d9ccb2] bg-[#f1e9d8] px-5 py-3"><TerritoryShare t={year} vis={vis} /></div>
        </aside>
      </div>

      {/* TIMELINE */}
      <footer className="relative z-20 border-t border-[#d6c8aa] bg-[#f3ecdd] px-4 pb-3 pt-2 sm:px-6" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-1">
            <button onClick={goPrev} className="grid h-9 w-9 place-items-center rounded-md text-[#3a3026] hover:bg-[#e9dfca]" aria-label="Previous event" title="Previous event (←)"><SkipBack size={17} /></button>
            <button onClick={() => setPlay(!playing)} className="grid h-10 w-10 place-items-center rounded-full bg-[#3a3026] text-[#f7f3ea] shadow hover:bg-[#2b2119]" aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (space)">
              {playing ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
            </button>
            <button onClick={goNext} className="grid h-9 w-9 place-items-center rounded-md text-[#3a3026] hover:bg-[#e9dfca]" aria-label="Next event" title="Next event (→)"><SkipForward size={17} /></button>
          </div>
          <div className="display num min-w-[132px] text-[22px] font-semibold leading-none text-[#2b2119]">
            {active && info.phase === 'dwell' ? fmtDate(active.d).replace(/^(\d+) (\w{3})\w*/, '$1 $2') : fmtMonth(year)}
          </div>
          <div className="hidden min-w-0 flex-1 truncate text-[14px] italic text-[#6e604f] md:block">{active ? active.title : 'Prologue'}</div>
          <div className="ml-auto flex items-center gap-1 text-[12px]">
            <span className="mr-1 text-[#8a7862] caps text-[10.5px]">Speed</span>
            {[0.5, 1, 2, 4].map((v) => (
              <button key={v} onClick={() => setSpd(v)} className={`num rounded px-1.5 py-0.5 ${speed === v ? 'bg-[#3a3026] text-[#f7f3ea]' : 'text-[#5d4d3c] hover:bg-[#e9dfca]'}`}>{v}×</button>
            ))}
          </div>
        </div>

        {/* track */}
        <div ref={trackRef} className="relative mt-2 h-[58px] cursor-pointer select-none touch-none" role="slider" tabIndex={0}
          aria-label="Timeline" aria-valuemin={T0} aria-valuemax={T1} aria-valuenow={Math.floor(year)} aria-valuetext={fmtMonth(year)}
          onPointerDown={(e) => {
            const r = trackRef.current.getBoundingClientRect(); trackRef.current.setPointerCapture(e.pointerId);
            S.current.scrubbing = true; seekYear(txInv(clamp((e.clientX - r.left) / r.width, 0, 1)));
          }}
          onPointerMove={(e) => {
            const r = trackRef.current.getBoundingClientRect(); const t = txInv(clamp((e.clientX - r.left) / r.width, 0, 1));
            if (S.current.scrubbing) seekYear(t);
            let best = null, bd = 7;
            events.forEach((ev, i) => { const x = tx(ev.t) * r.width; const d = Math.abs(x - (e.clientX - r.left)); if (d < bd) { bd = d; best = i; } });
            setTlHover(best == null ? null : { i: best, x: e.clientX - r.left });
          }}
          onPointerUp={(e) => {
            S.current.scrubbing = false; trackRef.current.releasePointerCapture?.(e.pointerId);
            if (tlHover) seekEvent(tlHover.i);
          }}
          onPointerLeave={() => setTlHover(null)}>
          {/* era bands */}
          {ERAS.map((er, i) => {
            const l = tx(er.from) * 100, w = (tx(er.to) - tx(er.from)) * 100; const cur = er === era;
            return (
              <div key={er.title} className={`absolute top-0 h-[17px] overflow-hidden border-r border-[#f3ecdd] px-1 text-[10.5px] leading-[17px] ${cur ? 'bg-[#3a3026] text-[#f7f3ea]' : i % 2 ? 'bg-[#e6dcc6] text-[#5d4d3c]' : 'bg-[#ddd1b7] text-[#5d4d3c]'}`}
                style={{ left: `${l}%`, width: `${w}%` }} title={`${er.title}: ${er.sub}`}
                onPointerUp={(e) => { if (!tlHover) { e.stopPropagation(); S.current.scrubbing = false; const k = events.findIndex((ev) => ev.t >= er.from); if (k >= 0) seekEvent(k); } }}>
                <span className="block truncate">{er.title}</span>
              </div>
            );
          })}
          {/* rail */}
          <div className="absolute left-0 right-0 top-[33px] h-[3px] rounded-full bg-[#ddd1b7]" />
          <div className="absolute left-0 top-[33px] h-[3px] rounded-full bg-[#8a3b22]" style={{ width: `${tx(year) * 100}%` }} />
          {/* event ticks */}
          {events.map((ev, i) => {
            const f = ev.f.find((x) => vis.includes(x)) || ev.f[0];
            const x = tx(ev.t) * 100;
            return ev.pv
              ? <div key={ev.id} className="absolute top-[27px] h-[9px] w-[9px] -translate-x-1/2 rotate-45 border" style={{ left: `${x}%`, background: FACTIONS[f].color, borderColor: FACTIONS[f].ink, opacity: i <= info.idx ? 1 : 0.65 }} />
              : <div key={ev.id} className="absolute top-[29px] h-[11px] w-[2px] -translate-x-1/2 rounded-full" style={{ left: `${x}%`, background: FACTIONS[f].ink, opacity: i <= info.idx ? 0.9 : 0.4 }} />;
          })}
          {/* year labels */}
          {[...Array.from({ length: 13 }, (_, k) => 1740 + k * 5), 1830, 1858].map((y) => (
            <div key={y} className={`num absolute top-[42px] -translate-x-1/2 text-[10.5px] text-[#8a7862] ${y % 10 && y < 1805 ? 'hidden sm:block' : ''}`} style={{ left: `${tx(y) * 100}%` }}>{y}</div>
          ))}
          {/* axis break before the compressed epilogue */}
          <div className="pointer-events-none absolute top-[28px] h-[13px] w-[7px] -translate-x-1/2 border-x border-[#9c8a6e] bg-[#f3ecdd]" style={{ left: `${TX_FRAC * 100}%`, transform: 'translateX(-50%) skewX(-18deg)' }} title="Time scale compressed after 1805" />
          {/* playhead */}
          <div className="pointer-events-none absolute top-[19px] h-[30px] w-[2px] -translate-x-1/2 bg-[#2b2119]" style={{ left: `${tx(year) * 100}%` }}>
            <div className="absolute -left-[5px] top-[10px] h-3 w-3 rounded-full border-2 border-[#f7f3ea] bg-[#8a3b22] shadow" />
          </div>
          {/* hover tip */}
          {tlHover && events[tlHover.i] && (
            <div className="pointer-events-none absolute bottom-[60px] z-30 w-max max-w-[260px] -translate-x-1/2 rounded border border-[#bfae8c] bg-[#fbf8f1] px-2 py-1 text-[12.5px] shadow-md"
              style={{ left: clamp(tlHover.x, 120, (trackRef.current?.clientWidth || 400) - 120) }}>
              <div className="num text-[11px] italic text-[#7a6650]">{fmtDate(events[tlHover.i].d)}</div>
              <div className="font-medium text-[#2b2119]">{events[tlHover.i].title}</div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function EventLinks({ list, events, onSeek, year }) {
  return (
    <ul className="flex flex-col gap-1">
      {list.map((e) => {
        const idx = events.indexOf(e);
        const Icon = TYPE_META[e.ty].icon;
        return (
          <li key={e.id}>
            <button disabled={idx < 0} onClick={() => onSeek(idx)}
              className={`flex w-full items-start gap-2.5 rounded px-1.5 py-1 text-left hover:bg-[#efe6d3] disabled:cursor-not-allowed disabled:opacity-50 ${e.t <= year ? '' : 'opacity-70'}`}>
              <Icon size={14} className="mt-1 shrink-0 text-[#7a6650]" />
              <span><span className="num block text-[11.5px] italic text-[#8a7862]">{fmtDate(e.d)}</span><span className="text-[14.5px] leading-snug text-[#2b2119]">{e.title}</span></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// @geo-begin (generated by scripts/build-geo.mjs — Natural Earth 1:50m, Mercator)
const GEO = {"W":999,"H":942,"proj":{"lon0":60.5,"lat1":37,"k":27},"land":"-40,-40 1039,-40 1039,861.2 1033.8,858.4 1031.5,853 1028.1,850.6 1026,851.3 1023.8,855.1 1022.3,854.9 1020.7,853.8 1019,848.4 1019.1,839 1021.3,833.5 1022.6,824.7 1031.5,800.1 1030.2,800.4 1027.7,804.4 1025.9,800.3 1026.6,795.6 1025.1,786.8 1026.9,785 1030.7,778.2 1030.9,774.2 1032.6,771.3 1032.5,761.5 1033.8,759.5 1036.2,758 1034.2,756.4 1031.2,758.1 1029.7,757.5 1030,752.8 1031.1,751.5 1030.4,746.8 1031.3,744.1 1028.7,743.5 1029.2,742 1030.8,740.7 1029.4,738.1 1030.4,735.4 1030.4,732 1028,718.2 1025.7,714.5 1023.8,709.2 1019.2,702.3 1019,696.7 1017.9,695.4 1016.5,704.7 1015.5,702.8 1014.5,695.3 1015.2,690.4 1012.5,685.5 1010,676.7 1010.6,675.5 1013,676.7 1010.8,673.6 1009,674.3 1007.4,670.9 1007.1,661.8 1005.6,658.4 1006.4,654.9 1004.7,642.4 1001.3,638.4 1002.8,631.8 1002.6,626.1 1005.1,623 995.6,624.3 994.5,620.1 992.7,618.1 991.2,613.8 990.3,609 990.9,608.1 981.4,599.5 983.1,602.2 981.4,605.1 983,609.9 979.2,619 975.3,623.1 970.2,624.8 968.3,624.3 966.1,622.2 965.2,617.4 963.6,617.3 964.9,623 967.3,626.5 962.1,629.3 959.7,629.4 958.8,631.8 952.1,634.2 949.9,639.6 946.5,643.5 942,646.7 939.7,645.8 939.8,642.3 941.3,639.4 940.8,636.2 940.5,638 936.3,643.8 929.9,644 928.6,639.6 928.6,633.8 927.4,638 926,639.7 922.4,641.6 922.1,637.1 923.9,627.7 923.5,624.6 922.4,629.5 920.4,630.8 916.4,636.3 912.5,638.7 910.6,638.5 910.3,635.4 911.9,624.4 914.1,620.9 915.3,614.5 916.7,612.1 917.3,607 919.7,602.1 920.4,594.7 917.9,587.5 916.1,576.8 909.1,561.7 911.2,561.4 907,558.3 906.4,557.1 905.7,545.8 904.6,548.8 902.9,549.9 903.6,554.2 902.6,556.9 896.6,553.2 890.9,543.5 893.1,542.6 897.2,546.4 899.8,547.2 903.5,544.6 904.5,541.4 900.2,538.7 898.2,536.6 897.5,534.1 894,531.8 896.6,527.9 893.2,528 888.5,524.3 884.2,523.3 881.7,524.2 882.9,528.3 882.7,529.6 881,529.4 877.5,523.2 880.1,520.1 877.9,520 879.3,514.5 878.4,513.7 877.2,517.1 874.3,521 872.9,520.2 871.9,519.3 874.5,515.6 870.3,509.2 869.7,509.1 870.1,516.9 866.9,511.9 858.8,502.6 852,491.5 850.7,476.7 848.2,470.9 845.8,460.9 846.8,457.3 845,458.8 842.3,452.8 837.8,446.9 836.5,444.2 836.4,441.7 829.3,448.8 822,450.1 818.8,446.5 813.6,435.5 814.2,430.3 812.8,420.9 811.6,422.5 811.5,425.9 803.8,424.9 807.1,427.5 810.6,428.1 812.4,430.5 812.6,434.4 809.1,436.7 809.4,438.7 811.4,441.1 808.9,441.8 808.2,445.5 810,449 809.7,450.3 812.6,454.8 813.1,457 812.4,460 806.1,466.1 802.7,472.5 800.8,472.9 798.4,470.8 798.9,467 802.1,462.9 795.3,466.8 794.2,464.2 793.7,458.5 796.1,453.9 793.3,456.2 792.5,459.1 792.9,462.5 791.4,468 784.8,474.3 782.6,459.5 783.1,470 779.1,475.6 775.9,475.6 774,473.8 772.1,471.2 770.9,464.8 770.2,469.4 768.1,469.3 770,472.3 770.9,477.6 767,477.6 765.7,475 765,477.4 762.6,479.6 761.3,477.3 761.2,475.3 762.5,467.3 761.6,465.9 760.3,465.6 759.8,464 757.8,472.4 758.7,475.8 758.3,477.4 754.6,478.8 750.3,474.6 749.3,478.5 745.8,478.1 744,476.4 747.4,466.6 747.8,463.5 742.3,459.8 740.9,456.6 741.5,460.1 746.8,464 741.1,472.6 737.8,475.5 733.8,477.6 718.2,482 711.7,489.7 711.2,493.5 713.9,503.9 714.8,505.2 709.1,513.3 708.8,516.4 702,520.4 698.7,525.2 695.1,523.8 696.9,525.7 696.1,527.7 694.3,528.4 677,534.2 674.9,534.1 676.6,532.5 676.5,529.2 675.1,528.6 673.9,528.4 668.2,532.3 665.9,536.2 666.4,537 671.5,534.6 673.3,535.2 673.4,536.1 667.6,539.5 655.3,550.4 653.1,555 637.4,574.2 625.2,580.5 612.9,593.6 606.8,597.8 596.5,603.1 590.2,608.1 588.1,612.6 590.2,616.9 589.3,620.3 587.5,623.2 574.1,629.7 564.4,628.7 561.2,629.5 557.1,640 554.3,642.3 552.9,645.7 549.9,645.1 548.8,645.5 547.6,642.7 543.9,641.9 536.9,644.8 534.4,647.1 529.3,657.9 527.9,664.9 531.3,681.5 531.1,685.2 529.6,689 534.8,709.2 530.7,702.8 528.2,705.8 529.6,707.9 534.3,710.5 535.8,712.6 532.7,731.2 530.3,737.8 526,743.8 522.7,750.6 519.8,762 520.9,765.6 518.2,769.2 521.1,768.5 522.1,770.4 522.2,796.4 517.5,797.1 513.8,796.3 510,796.9 508,798.3 506.3,800.5 506.4,804.4 499.4,814 497.3,820.3 500,823.6 506.9,824.9 509.1,825.8 510.6,827.4 505.3,825.7 498.9,825.3 483.9,829.8 477.7,835.7 475.9,846.1 474.2,849.5 466.3,854.8 461.3,856.4 459.5,857.8 453.6,856 447.2,851.4 433.4,835.3 431.2,828.3 429.3,826.2 427.3,820.3 425.1,807.3 427.8,810 428.7,817.9 429.8,818.4 430.9,818 427.9,807.4 424.5,804.6 423.9,799.8 416.4,783.8 411.1,767.9 405.6,758.5 400,751.4 396.8,748.7 390,734.7 385.3,720.5 382.6,704.1 380.9,699 377.9,693.6 374.8,681.1 363.2,664.9 361.4,658.4 359.2,655.9 362.7,655.9 358.3,650.9 359.9,648.5 357.3,648.6 355.9,647.1 353.9,642.6 350.3,637.5 346.6,626 344,605.2 341.5,595.9 341.7,593.2 337.3,579.7 335.3,566.1 334.1,564.2 334.8,560.3 337.7,553.4 336.7,549.6 334.8,553.6 333,554.7 332.1,551.7 332.4,545.4 337.2,546.1 331.8,543.7 330.9,541.1 332,539.1 330.1,537.5 328.6,530.2 329.6,523.1 334.3,509.1 334.7,506 332.4,493.1 329.2,491.4 327.4,485.8 330.3,482.9 327.1,483.2 332.3,478.6 340.5,474.8 333.2,476.6 325.1,476.3 326.5,471.1 329.4,468.4 324.6,468.2 325.4,462.8 332.3,460.7 326.4,459.4 322.8,460.3 315.4,459.7 318.7,462 318,464.9 317.1,466.7 313.1,469.9 311.5,472.7 315.1,474.1 316.2,475.4 317.5,477.4 317.4,481.2 311,492 298.9,497.4 294.2,500.3 284.1,504.1 280.2,504.8 276,504 269.5,501.2 259.9,493.8 249.7,481.9 234.7,467.7 229.7,461.8 228.7,459 229,456.3 230.9,454.8 233,455.4 237,459.2 244.4,455.6 247.2,455.8 249.1,454 251.6,454.3 256.6,451.5 261.3,450.8 268.4,439.2 270.3,438.2 269.7,435.7 268.2,436 265.7,440.1 263.3,439.1 259.7,439.9 252.4,442.5 249.4,444.9 247.5,445.3 235.9,442.8 224.5,436.7 219.8,432.7 213.8,421.5 214.7,419.8 223.5,413.2 215.9,416.3 211.8,420.2 208.8,420.8 207,413.1 205.6,416.2 203.5,413.3 201.2,413.9 198.7,411.8 197.6,414 193.5,414.4 193,411.2 190.7,412.4 189.1,410.6 188.4,408.3 185.4,406.2 183.8,403.7 183.3,398 180.1,386.4 178.2,385.4 167.5,383.3 166.9,381.3 167.4,372.4 163.9,367.9 162.9,364.7 160.1,362 157.3,361.2 154.4,361.6 152,364.4 158.2,364 161.2,365.9 154.9,365.3 145.3,366.7 139.9,368.6 132.5,368 123.2,369.9 115.5,370 112.3,373.7 109.2,372.1 98.6,369.2 96.1,367.1 92.7,369 87,367.7 82.5,368.6 80.9,370.3 80.8,372.9 72.1,371.6 68,372.5 58.4,371.3 56,371.6 49,375.2 45.9,372.5 42.9,374.6 38,375.3 33.5,375.1 28.8,373.6 29.4,373.2 27.9,373.4 24.6,376.2 4.4,370.8 2.3,366.8 0.3,366.2 -2.7,369.9 -12.8,367.7 -16.3,368.4 -18.4,367.2 -23.9,367.1 -28.2,364.8 -34.4,366.4 -40,366.3|-40,433.6 -28.9,448.2 -26,450.6 -18.3,452.7 -17.9,455.2 -18.9,461.1 -30.5,482.1 -40,489.6|518.6,858.2 519.7,852 519.7,858.6 520.6,859.5 521.3,858.6 522.5,848.8 524.9,841.1 524.6,835.4 528.3,830.1 529.2,826.9 529.7,823.8 528.8,816.9 535.1,819.9 538,819.5 536.9,817.7 533.4,816 527.7,814.9 525.3,812.3 525.6,811 526.1,810.4 533.4,810.9 536.7,815.1 545.7,822.7 550.7,830.4 551.7,833.4 554,834.5 558.8,841.9 559.6,846.2 562.5,847.1 563.6,848.2 565.2,856.8 571.5,865.9 571.9,868.6 575.9,875.5 577.1,879.4 576.8,889.9 572.7,900.5 570.7,902.8 563.8,907.8 546.1,914.9 539.9,915.7 533.7,914.1 529.1,910.2 522.7,891.8 520.9,871.3|810.1,443.1 812.6,442.3 814.7,443.8 816.4,448.9 819.9,453.4 818.9,462.8 817.5,464.9 812.8,465.9 810.4,465.6 814.8,458 814.1,451.7 811.7,449.5|824.7,464.5 825.6,452.4 828.4,459.3 827.6,462.4|834.6,453.7 835.8,449.5 838.6,456.4 837.3,457.2 836.1,456.5|846.6,476 848.7,475.6 849.2,476.7 849.2,481.8 847.5,482 846.7,481.1|860,784.7 862.6,781.5 864.3,780.7 866,786 863.3,791 860.4,790.3|864.9,753.8 866.9,751.7 868.8,745 871.8,744.1 871.5,741.9 870,740.4 870,735.3 871,731.8 870.4,728.7 872.3,726 873,722.5 872.4,721.5 873.8,716.2 873.7,712.7 875.5,709.2 879.2,707.5 879.6,711.5 877.9,713.3 879.5,715.7 879.3,716.5 877.6,720.1 876.2,720.9 874.4,724.2 876.6,726.8 877.2,735.4 875.7,737.8 873.8,738.3 874.2,744 870.6,750.5 872,753.7 871.1,760.3 869.4,763.7 866.1,758.1|875.1,525.4 875.2,522.9 876.4,524 878.1,530.3 876.9,529.2|885.9,861 886.5,859.8 887.7,859.5 889.2,861.4 889.5,863.3 887.4,863.3|888.6,526.8 890.8,528.5 891.3,532.4 889.5,530.9|889.8,855.3 890.9,853.9 891.8,854.2 891.3,855.6 892,858.4 890.8,859.5|890.7,557.8 894.2,557.2 897.6,557.8 896.9,562.1 895.7,563.3|893.6,878.5 896.2,876.1 897.3,877.5 894.7,880.1|894.8,539.9 896.8,538 903,541.8 902.7,543.6 899.5,545.5 898,544.7 897.3,542.1|895.2,883.5 896,882.2 899.7,880.8 900.7,881.6 902.6,887.9 901.5,891.8 899.9,894.1 896.7,887.2 895.2,886.8|915,639.1 917.9,636.8 920.7,633.2 921.2,635 919.8,638.4 915.6,643.2|937.1,933.8 938.2,930.4 937.6,926.2 942.2,924.5 951.4,925.8 959.2,932 965.3,934.3 975.1,935.5 981.3,934.1 984.7,934.2 990.7,935.9 999,935.3 1010,944.7 1012.5,950.7 1019.2,957.4 1019.8,959.9 1019,963.3 1020.8,966.1 1030.2,970.6 1033.5,975.1 1039,977.8 1039,982 986.1,982 982.6,978 980.1,976.5 972.7,974.9 970.5,973.6 964.7,966.6 958.2,961.5 947.1,950.7 943.2,945.2|937.4,917.4 938,916.9 941.2,917.7 941.3,919.5 940.7,920.2 939.2,919.8|998.2,626 1000.1,624.8 1001.2,625.3 1001.7,626.9 1001,631.8 1000,632.2 998.5,630.4|1012.7,754.1 1014.7,757.7 1014.8,760.3 1013,758.7|1013.5,743.9 1014.4,742.2 1015.8,742.6 1016.1,746.1 1014.5,745.7|1014.7,780.9 1017,778.4 1018.2,779.1 1020.4,783.9 1020.1,784.6 1019.3,784.9 1018.4,782.3 1016.7,780.7|1015.7,808.6 1016.2,806 1018.5,804.1 1020.3,803.9 1018.8,806.6|1017.5,764.8 1017.9,762.2 1020.6,756.3 1019.6,763.4 1018.4,765.3|1019.3,719.8 1019.6,717 1021,719.9 1020.8,724.5 1019.5,722.3|1019.6,862 1021.2,855.4 1022,856.9 1024.2,857.7 1023.2,860.9 1023.2,864.7 1022.2,864.6 1020.5,866.1|1020.6,733.4 1020.9,731.5 1023.2,732.4 1024.3,734.5 1025.2,734.5 1024.9,737.2 1022.8,740.5 1021.5,741 1021.5,736.1|1022.7,756 1026.6,755.7 1027.4,757.3 1026.7,763 1024.2,762.2|1024.8,748.6 1025.1,747.9 1026.6,750.1 1029,751.5 1025.3,753.1","borders":"162.6,-11.8 151.5,-14.1 142.1,-19.3 138.8,-15.8 136.5,-8.5 123.9,-8.1 116.6,-4.5 108.3,22.2 104.2,26 97,29.8 94.8,33.2 90.8,33.2 75.6,38.3 71,38.7 70.4,39.7 72,44.3 70.7,45.7 69,52 59.1,58.3 57,59.1 53,58.4 48.8,61.1 46.3,57.2 40.1,52.1 30.2,52.5 24.9,48.7 22.9,46 20.6,46.2 19.8,43.4 20.3,38 17.6,34.3 19.3,30.3 19.3,27.2 18.2,23.9 18.1,14.4 16.7,12.1 -4.3,12.2 -11.8,1.2 -14.9,-1.4 -25.4,-6.1 -30.6,-11.3 -32.4,-17.3 -34,-17.7|1031.5,800.1 1033.3,793.5 1033,787.1 1036.5,783.7|1037.7,693.5 1027.9,684.9 1019.2,672.2 1017.3,662.9 1018.8,660.2 1024.7,657 1027.5,656.7 1028.5,637.6 1034.6,633.9 1035.9,632.3 1036.5,629.1 1035.1,627.2 1031.1,630.4 1030.3,629.6 1025.4,618.4 1024.3,611.5 1004.6,588.3 1005.5,584.3 1002.5,574.2 999.6,574.1 997.7,572.3 995.6,567.7 999.4,568.3 1005.7,565.8 1004.6,556 1007.2,550.3 1007.6,540.9 1012.3,535.3 1012.9,532.6 1015.5,532.2 1019,534.3 1022.6,534.3 1037.2,531.9 1038.4,531|385.8,-37.6 387.3,-35.3 389.8,-26.3 388.6,-20.4 394.2,-15.3 394.7,-13.1 388.5,-7.8 382.3,-13.4 378.6,-12.9 373.9,-14.2 371.5,-14.1 369,-11.2 357.7,-7.8 355.2,-8.1 354.4,-8.9 356.8,-11.2 356.9,-14.2 350.5,-16 347.8,-15.7 334.7,-9.1 331,-5.8 328.3,-1 320.2,0.6 314.7,3.3 305.1,10.3 303.3,10.7 299.6,9 295.2,-4.3 299.2,-30.9 298.4,-31.7 292.1,-30.6 291,-31.2 292.5,-39.9|267.8,-36.6 262.3,-31.4 263.3,-22.6 261.6,-19.7 259.7,-18.4 257.7,-18.6 254.9,-20.4 251.7,-20.7 242.8,-18.8 240.9,-16.5 240.3,-13.5 240.7,-7.1 237.7,-3.9 236.7,-3.6 228.4,-11 227.1,-11.3 224.7,-9.2 220.6,-8.8 217.3,-6.2 213,-4.6 210.5,-3 209.6,-0.4 208.2,-0.7 204.3,1.7 201.4,0.9 198,-2.2 196,-5.8|467.1,50.3 457.5,51 447.9,48.5 439.2,44.9|212.1,-39.9 208.9,-32.7 207.2,-31.6 198.8,-19.4 197.5,-16.5 197,-8.3 196,-5.8 194.4,-7.7 191.9,-7.5 189.5,-9.1 184.1,-7.1 180.8,-7.9 177.4,-11.4 170.9,-12.6 162.6,-11.8 162.7,-26.7 165.4,-32.7 164,-34.4 159,-35.8 153.2,-39.8|20.6,46.2 21,49.8 18.6,56.4 16.2,57.7 17.5,63.7 15.4,69.3 15.7,71.5 12.4,76.3 12.2,78.2 6.1,82.6 10.5,89.1 3.9,89.5 -0.4,96.5 0.7,104.6 -0.4,108.9 0.3,111.2 4.2,113.8 11,114.5 11.3,115.6 1.7,127.5 1.7,130 8.9,156 7.8,164.3 8.7,179.9 31.3,183.5 33.9,186.6 35.5,193.3 35.4,198.3 34.7,200.9 9.2,231.3|840.6,296 840.8,291 830.9,286.3 824.1,289.6 815.8,286.5 806,286.2 805.9,281.2 796,279.1 791.5,280.8 789.8,282.9 782.5,286.8 773.8,297.5 772.3,301.1 768.1,305 766.5,309.5|859.3,502.6 855.4,488.1 858,484.1 859.5,483.8 865.1,487.3 865.9,488.9 867.5,487.7 866,468.2|1035.8,432.7 1036.4,427.1 1034,423 1035,419.9 1033.7,416.6 1030.9,413.5 1030.7,411.7 1035,405.3 1028.3,406.8 1026,405.4 1018.2,405.6 1012.9,406.9 1002.5,412.2 1000.7,411.5 1000.9,409.2 1004.2,405 1004.6,402.1 1003.5,397.6 999.8,394.3 999.8,390.2 1001.3,385.9 1005.5,383 1004.8,378.2 1007.6,371.7 1010.3,372.1 1012.7,370.5 1015.2,366.8 1016.3,362.1 1017.1,361.4 1020.5,362.2 1021.5,361.6 1025.1,355.6 1029.4,354.5 1030.2,353.4 1027.7,347.1 1027.9,345.9 1030.4,345.1 1031,343.6 1030.6,340.3 1032.5,328.2 1030,301.7 1024.7,299.1 1023.5,299.7 1022,302.7 1020.5,302.4 1016.1,289.7 1015.2,284.3 1009.4,277.7 1006.2,277.7 1003.3,273.3 1000,273 994.2,282|379.1,-0.8 374.5,-5.3 384.1,-9.8 385.2,-8.4 388.5,-7.8|29.4,373.2 31.4,356.8 33.8,354 36.3,342.5 42.9,339.7 43.9,338.2 47,338.5 48.9,334.5 52.4,332.4 60.8,330 71.7,329.7 72.5,324 74.3,322.8 74.1,316.8 75.6,314.5 72,311.4 65.2,312.5 61.1,311.5 62.4,304 60.5,288.6 61,281.2 55.7,281.5 50.1,275.9 37.5,271.9 30.3,264.3 22.7,249.8 22.1,246.4 9.2,231.3 53.4,245.3 82.8,242.5 97.2,245.8 99.2,243.7 105.1,241.1 124,240.6 154.8,231.1 157,227.9 155.1,225.5 154.9,223.5 156.8,216.9 156.2,207.9 157.9,201.8 159.2,198.4 164.6,195 168.3,189.4 170.9,187.2 173.4,185.9 176.2,186.1 178.7,187.9 183.2,188.7 187.7,188.2 195.4,184.7 195.3,183.6 191.6,181.3 191.1,179.6 195.5,178.2 203,174.2 206.9,170.2 214.4,171.7 218.6,170.2 223.7,175.2 226,175.5 231.7,172.2 237.1,165.9 236,150 240.5,142.1 240.4,139.5 241.7,137.2 243,131.3 244.9,129.8 254.4,128.3 263.5,122.6 264.2,120 260.1,111.9 252.9,102.8 253.5,99.3 256.3,97.8 265.3,100.8 274.1,101.1 284.9,97.9 286,95.6 286.1,87.4 282.6,82.2 285.3,79.9 291.4,71.1 295.8,67.8 300.3,60.7 298.2,57.2 299.7,53.3 298.9,48.7 297.5,47 295,39.1 292.8,35.6 288.5,32.2 289.8,29.5 300.3,19 304.3,19.1 313.1,12.4 314.7,10.1 317.3,9 327.3,5.7 340.7,4.5 358.3,3.8 365.6,5.9 380.7,-1.2 383.2,-1.2 388.5,1.6 393,0.4 395.4,0.9 400.9,2.9 402.9,8.8 407,8.1 409.5,8.7 415.4,13.5 417.8,20.8 417.7,28 415.9,30.6 416.1,32 420.4,34.2 422.4,39.3 425.3,39.9 433.4,37.3 433.7,41.2 439.2,44.9|553.8,221.8 556.5,225.8 558.2,225.7 560.4,224 564.7,216.4 570.9,214.8 581.7,216.7 584.8,223.3 586.4,224.9 593.6,228.7 603.5,236.8 607.9,238.8 611.7,238.9 623.3,252.3 632.8,249.3 637.3,251.2 640.7,260.7 656,271.5 663.4,270 665.8,270.5 663.9,277.3 664.8,279 679.8,280.2 684.2,284.5 687.2,290.9 688.4,291.4 690.2,290.7 690.6,286.1 692.2,285.1 694.4,288 699.6,290.8 702.5,289.8 703.5,286 705.1,285.5 707.1,285.8 708.8,288 716.1,290.8 719.3,293.6 732.3,294.3 738.7,292.1 745.4,292.6|467.1,50.3 469.7,51.9 473.7,50.9 472.8,58.5 481.4,79.7 490.6,82.6 497.8,88 498.7,89.7 498.7,92.1 492.8,96.7 492.1,99.1 493.7,105.7 494.2,115.7 502.5,124.6 503.1,126.3 502.2,130.2 505,133.6 505.8,141.4 505.5,147.9 502.9,148.7 501.3,151.5 497.3,152.5 493.3,149 491.5,144.8 483.7,146.1 483,147.3 485.9,157 492.3,165.2 491.3,172.2 494.2,176 492.1,180.7 493,181.8 492.5,185.4 495.3,186.1 498.7,185.2 499.8,182.5 502.3,182.9 508.7,192.2 512.8,195.8 514.8,197.2 520.9,196.6 528.7,202.4 530.5,202.2 531.7,203.2 531.7,209.1 544.9,213.9 553.1,219.5 553.8,221.8|745.4,292.6 745.4,290.7 746.3,290.2 754,288.3 758.1,285.8 764.2,288.4 765.4,292.7 762.7,303.3 763.1,306.1 766.5,309.5|840.6,296 849.9,296.9 853.2,294.5 857.2,293.5 861.7,294 865.3,292.4 869.1,289 867.9,286.8 869.5,284.2 874.3,281.7 880.7,276.4 884.3,269.4 895.4,267.5 898.1,266.3 903.8,262.3 905,259.2 907.5,258.7 912.4,253.5 921.3,248.3 924.3,250.1 925.3,252.5 931.5,253.3 942,256.8 945.5,253.3 945.4,251.5 959.5,244.1 964.8,250.4 968.1,250.2 967.6,251.4 961.8,255.4 962.2,260.3 962.9,260.7 970.3,256.4 974.2,265.2 969.2,270.1 966.1,276 969,277.4 974.7,274.5 979.4,277.4 984.9,278.3 987.6,277.4 994.2,282|994.2,282 993.7,286 994.7,287.7 994.6,290.6 984.5,297.9 982.1,301.3 982.8,305.7 988.3,314.1 988.3,315.6 986.5,316 984.3,315.1 978.2,309 963.7,311.2 960.2,312.5 956,317.7 944,326.5 935,331.3 933.1,335 932.8,338.8 933.3,343.5 935.1,348 931.9,351.9 931.3,356.2 930,358.3 925.8,363.7 922.5,365.5 920.1,369.6 919.4,372.7 922.7,375.1 923.6,377.7 920.3,386.1 912.4,399.3 908,412.5 895.9,408.7 890.9,409.7 887.1,406.7 886.3,407 885.8,408.2 888.7,418.3 888.5,422.8 887,435.8 884.3,437.9 881.9,437.4 881.9,441 879.6,446.6 881.9,457 881.6,460.8 878.7,462.2 876.6,467.4 873.6,467.2 871.3,464.5 869.1,463.7 867.5,467.2 866,468.2","regions":{"kashmir":{"c":[404.2,73.6],"r":"297.2,22.2 300.3,19 304.3,19.1 305.7,17.3 313.1,12.4 314.7,10.1 327.3,5.7 358.3,3.8 365.6,5.9 380.7,-1.2 383.2,-1.2 388.5,1.6 393,0.4 400.9,2.9 402.9,8.8 403.9,9.3 407,8.1 409.5,8.7 412.3,10.3 415.4,13.5 417.8,20.8 417.7,28 415.9,30.6 416.1,32 417,33 420.4,34.2 422.4,39.3 423.3,39.9 429,39 433.4,37.3 433.7,41.2 435.6,42.6 442.3,46.5 447.9,48.5 457.5,51 467.1,50.3 469.7,51.9 472.8,50.6 473.7,50.9 472.8,58.5 480.1,78.1 481.4,79.7 490.6,82.6 497.8,88 498.7,89.7 498.7,92.1 492.2,97.7 493.7,105.7 494.2,115.7 498.1,120.7 502.5,124.6 503.1,126.3 502.2,130.2 505,133.6 505.8,140.8 502,137 498,137 496,135 476,135 474,137 470,137 468,135 466,135 462,131 460,131 457,128 457,124 455,122 455,118 452,115 450,115 448,113 442,113 440,115 430,115 427,118 427,120 421,126 421,130 419,132 419,136 417,138 417,140 416,141 412,141 410,139 360,139 358,141 352,141 351,140 353,138 353,130 355,128 355,112 353,110 353,106 351,104 351,98 349,96 349,56 347,54 347,52 342,47 340,47 338,45 336,45 324,33 318,33 316,31 314,31 310,27 306,27 304,25 300,25"},"peshawar":{"c":[278.8,134.1],"r":"205,176 207,174 207,170.2 208.3,170 211.1,171.3 214.4,171.7 218.6,170.2 223.7,175.2 226,175.5 228.8,174.5 231.7,172.2 237.1,165.9 236,150 240.5,142.1 240.4,139.5 241.7,137.2 243,131.3 244.9,129.8 254.4,128.3 263.5,122.6 264.2,120 260.1,111.9 252.9,102.8 253.5,99.3 256.3,97.8 265.3,100.8 274.1,101.1 279.4,100.1 284.9,97.9 286,95.6 286.1,87.4 284.1,85.5 282.6,82.2 285.3,79.9 286.6,77.3 291.4,71.1 295.8,67.8 300.3,60.7 298.2,57.2 298.2,55.9 299.7,53.3 298.9,48.7 297.5,47 295,39.1 292.8,35.6 289.5,33.6 288.5,32.2 289.8,29.5 297.2,22.2 300,25 304,25 306,27 310,27 314,31 316,31 318,33 324,33 336,45 338,45 340,47 342,47 347,52 347,54 349,56 349,74 348,75 344,75 342,77 338,77 336,79 334,79 327,86 327,88 325,90 325,92 317,100 317,102 315,104 315,106 313,108 313,112 311,114 311,118 309,120 309,138 308,139 306,139 304,141 300,141 297,144 297,154 295,156 295,160 297,162 297,176 299,178 299,182 301,184 301,188 303,190 296,197 294,197 292,199 290,199 288,201 286,201 284,203 280,203 278,205 274,205 272,207 270,207 266,211 264,211 260,215 258,215 249,224 249,226 248,227 246,227 244,229 240,229 237,226 237,224 230,217 228,217 215,204 215,202 213,200 213,198 211,196 211,194 209,192 209,190 207,188 207,184 205,182"},"punjab":{"c":[348.2,188.9],"r":"243,230 246,227 248,227 249,226 249,224 258,215 260,215 264,211 266,211 270,207 272,207 274,205 278,205 280,203 284,203 286,201 288,201 290,199 292,199 294,197 296,197 303,190 301,188 301,184 299,182 299,178 297,176 297,162 295,160 295,156 297,154 297,144 300,141 304,141 306,139 308,139 309,138 309,120 311,118 311,114 313,112 313,108 315,106 315,104 317,102 317,100 325,92 325,90 327,88 327,86 334,79 336,79 338,77 342,77 344,75 348,75 349,76 349,96 351,98 351,104 353,106 353,110 355,112 355,128 353,130 353,138 351,140 352,141 358,141 360,139 410,139 412,141 416,141 417,142 415,144 415,152 413,154 413,158 411,160 411,164 412,165 414,165 419,170 419,178 425,184 425,186 428,189 432,189 434,187 438,187 440,185 456,185 458,187 460,187 461,188 461,192 459,194 459,202 456,205 454,205 453,206 453,208 447,214 447,216 441,222 441,226 439,228 439,232 435,236 435,238 434,239 422,239 416,233 414,233 408,227 406,227 404,225 400,225 398,223 396,223 394,221 390,221 388,219 386,219 380,225 376,225 374,227 372,227 355,244 355,246 354,247 352,247 350,249 348,249 346,251 340,251 338,253 336,253 332,257 328,257 326,259 324,259 322,261 320,261 318,263 314,263 312,265 310,265 308,267 306,267 304,269 302,269 292,259 290,259 288,257 286,257 284,255 282,255 280,253 276,253 274,251 268,251 266,249 254,249 251,246 251,244 249,242 249,240 247,238 247,236 245,234 245,232"},"sindh":{"c":[221,329.3],"r":"159,336 161,334 161,330 163,328 163,312 165,310 165,308 171,302 171,300 176,295 178,295 180,293 182,293 186,289 188,289 198,279 200,279 202,277 208,277 210,275 214,275 216,273 222,273 224,271 232,271 236,267 238,267 241,264 241,262 254,249 266,249 268,251 274,251 276,253 280,253 282,255 284,255 286,257 288,257 290,259 292,259 303,270 303,272 298,277 296,277 293,280 293,282 291,284 291,286 286,291 284,291 282,293 280,293 278,295 276,295 267,304 267,306 265,308 265,312 263,314 263,316 260,319 258,319 256,321 250,321 247,324 247,328 249,330 249,338 247,340 247,342 245,344 245,358 247,360 247,362 249,364 249,366 253,370 253,372 255,374 255,376 257,378 257,380 260,383 262,383 271,392 271,394 270,395 254,395 252,397 220,397 215,402 215,404 204.5,414.5 203.5,413.3 201.2,413.9 198.7,411.8 197.6,414 193.5,414.4 193,411.2 190.7,412.4 189.1,410.6 188.4,408.3 185.4,406.2 183.8,403.7 183.3,398 180.1,386.4 178.2,385.4 167.5,383.3 166.9,381.3 167.7,375.9 167.4,372.4 163.9,367.9 162.9,364.7 159,361.7 159,360 161,358 161,354 163,352 163,346 161,344 161,338"},"balochistan":{"c":[132.7,282.7],"r":"9.2,231.3 53.4,245.3 82.8,242.5 97.2,245.8 99.2,243.7 105.1,241.1 108.6,240.5 124,240.6 153.3,232 154.8,231.1 157,227.9 155.1,225.5 154.9,223.5 156.8,216.9 156.2,207.9 159.2,198.4 163.8,195.7 168.3,189.4 173.4,185.9 176.2,186.1 178.7,187.9 183.2,188.7 187.7,188.2 195.4,184.7 195.3,183.6 191.6,181.3 191.1,179.6 192.5,178.6 195.5,178.2 203,174.2 207,170.2 207,174 205,176 205,182 207,184 207,188 209,190 209,192 211,194 211,196 213,198 213,200 215,202 215,204 228,217 230,217 237,224 237,226 240,229 242,229 245,232 245,234 247,236 247,238 249,240 249,242 251,244 251,246 253,248 253,250 241,262 241,264 238,267 236,267 232,271 224,271 222,273 216,273 214,275 210,275 208,277 202,277 200,279 198,279 188,289 186,289 182,293 180,293 178,295 176,295 171,300 171,302 165,308 165,310 163,312 163,328 161,330 161,334 159,336 161,338 161,344 163,346 163,352 161,354 161,358 159,360 159,361.7 154.4,361.6 152.9,362.6 152,364.4 158.7,364.3 157.6,365.4 145.3,366.7 139.9,368.6 132.5,368 123.2,369.9 115.5,370 112.3,373.7 109.2,372.1 98.6,369.2 97.9,368 96.1,367.1 94.2,368.7 92.7,369 87,367.7 82.5,368.6 80.9,370.3 80.8,372.9 72.1,371.6 68,372.5 58.4,371.3 56,371.6 51,374.7 49,375.2 45.9,372.5 42.9,374.6 38,375.3 33.5,375.1 28.8,373.6 30.1,370.7 31.4,356.8 33.8,354 35.4,344.3 36.3,342.5 42.9,339.7 43.9,338.2 47,338.5 48.9,334.5 52.4,332.4 57.7,331.4 60.8,330 70,330.2 71.7,329.7 72.5,324 74.3,322.8 74.1,316.8 75.7,315.3 75.6,314.5 74.5,312.8 72,311.4 65.2,312.5 61.1,311.5 61.2,308.3 62.4,304 60.5,288.6 61,281.2 55.7,281.5 50.1,275.9 37.5,271.9 30.3,264.3 22.7,249.8 22.1,246.4"},"hills":{"c":[476,182.2],"r":"411,160 413,158 413,154 415,152 415,144 417,142 417,138 419,136 419,132 421,130 421,126 427,120 427,118 430,115 440,115 442,113 448,113 450,115 452,115 455,118 455,122 457,124 457,128 460,131 462,131 466,135 468,135 470,137 474,137 476,135 496,135 498,137 502,137 505.8,141.4 505.5,147.9 502.9,148.7 501.3,151.5 497.3,152.5 493.3,149 491.5,144.8 483.1,146.5 485.9,157 492.3,165.2 491.1,170.1 491.3,172.2 494.2,176 492.1,180.7 493,181.8 492.9,186 498.7,185.2 499.8,182.5 500.7,182.1 502.3,182.9 508.7,192.2 514.8,197.2 520.9,196.6 528.7,202.4 530.5,202.2 531.7,203.2 531.7,209.1 543,212.9 552,219 547,224 547,226 537,236 537,246 535,248 535,250 526,259 522,255 520,255 513,248 513,246 510,243 508,243 502,237 496,237 494,235 484,235 478,229 476,229 471,224 471,222 469,220 469,208 468,207 466,207 464,205 460,205 459,204 459,194 461,192 461,188 460,187 458,187 456,185 440,185 438,187 434,187 432,189 428,189 425,186 425,184 419,178 419,170 414,165 412,165 411,164"},"delhi":{"c":[452.2,275.6],"r":"419,256 421,254 421,250 423,248 423,242 421,240 422,239 434,239 435,238 435,236 439,232 439,228 441,226 441,222 447,216 447,214 453,208 453,206 454,205 456,205 458,203 460,205 464,205 466,207 468,207 469,208 469,220 471,222 471,224 476,229 478,229 483,234 481,236 481,238 480,239 478,239 475,242 475,244 473,246 473,278 471,280 471,282 469,284 469,288 476,295 478,295 480,297 482,297 485,300 485,302 489,306 489,308 487,310 487,312 485,314 485,316 481,320 481,322 479,324 479,326 475,330 475,332 470,337 460,337 458,339 454,339 452,337 444,337 443,336 443,334 441,332 441,330 439,328 439,326 437,324 437,322 435,320 435,318 433,316 433,314 431,312 431,308 429,306 429,298 428,297 426,297 424,295 422,295 419,292"},"doab":{"c":[507.3,333],"r":"471,336 475,332 475,330 479,326 479,324 481,322 481,320 485,316 485,314 487,312 487,310 492,305 508,305 512,309 514,309 516,311 518,311 521,314 521,320 523,322 523,324 524,325 526,323 528,323 530,325 532,325 542,335 544,335 545,336 545,338 539,344 539,346 533,352 533,354 531,356 531,358 530,359 528,359 524,363 520,363 517,360 517,356 515,354 515,352 514,351 508,351 506,353 504,351 500,351 498,349 492,349 490,351 486,351 484,349 482,349 475,342 475,340"},"rohilkhand":{"c":[502.7,274.2],"r":"469,284 471,282 471,280 473,278 473,246 475,244 475,242 478,239 480,239 481,238 481,236 482,235 494,235 496,237 502,237 508,243 510,243 513,246 513,248 520,255 522,255 527,260 527,262 541,276 541,278 545,282 545,284 542,287 540,287 533,294 533,296 529,300 529,302 525,306 525,308 523,310 523,312 522,313 520,313 518,311 516,311 514,309 512,309 508,305 492,305 490,307 485,302 485,300 482,297 480,297 478,295 476,295 469,288"},"awadh":{"c":[577.4,314.3],"r":"521,314 523,312 523,310 525,308 525,306 529,302 529,300 533,296 533,294 540,287 542,287 546,283 548,285 552,285 554,283 576,283 578,281 588,281 597,290 597,292 602,297 604,297 608,301 628,301 629,302 629,318 627,320 627,332 610,349 606,349 604,351 596,351 595,350 595,348 590,343 588,343 586,341 572,341 568,337 566,337 564,335 550,335 548,337 546,337 544,335 542,335 532,325 530,325 528,323 526,323 524,325 523,324 523,322 521,320"},"allahabad":{"c":[566.7,361.8],"r":"531,356 533,354 533,352 539,346 539,344 546,337 548,337 550,335 564,335 566,337 568,337 572,341 586,341 588,343 590,343 595,348 595,356 593,358 593,368 591,370 591,372 583,380 583,384 581,386 581,392 579,394 579,396 578,397 576,397 574,399 566,399 565,398 565,394 563,392 563,390 561,388 561,386 557,382 557,380 551,374 551,372 549,370 549,366 544,361 536,361 534,359 532,359 531,358"},"benares":{"c":[608.8,377.8],"r":"579,394 581,392 581,386 583,384 583,380 591,372 591,370 593,368 593,358 595,356 595,352 596,351 604,351 606,349 610,349 626,333 628,335 632,335 634,337 636,337 637,338 637,342 639,344 639,348 637,350 637,360 635,362 635,366 634,367 632,367 630,369 628,369 627,370 627,372 619,380 619,386 617,388 617,418 615,420 615,422 614,423 606,423 604,421 600,421 598,419 596,419 593,416 593,414 591,412 591,410 589,408 589,404 582,397 580,397 579,396"},"bihar":{"c":[675.9,380.9],"r":"615,420 617,418 617,388 619,386 619,380 627,372 627,370 628,369 630,369 632,367 634,367 635,366 635,362 637,360 637,350 639,348 639,344 637,342 637,338 636,337 634,337 632,335 628,335 627,334 627,320 629,318 629,300 632,297 634,299 636,299 638,301 642,301 644,303 648,303 650,305 652,305 657,310 657,312 662,317 664,317 666,319 668,317 678,317 682,313 684,313 686,311 687,312 687,314 689,316 689,318 691,320 691,322 698,329 700,329 702,331 704,331 706,333 710,333 712,335 714,333 746,333 747,334 747,336 745,338 745,342 743,344 743,348 741,350 741,352 739,354 739,356 737,358 737,362 735,364 735,376 729,382 729,408 731,410 731,418 726,423 724,423 722,425 714,425 712,427 710,427 705,432 705,434 703,436 703,438 699,442 699,444 685,458 685,460 682,463 676,457 662,457 660,455 654,455 649,450 649,446 647,444 647,442 632,427 622,427 620,425 618,425 615,422"},"bengal":{"c":[787.8,393.5],"r":"729,382 735,376 735,364 737,362 737,358 739,356 739,354 741,352 741,350 743,348 743,344 745,342 745,338 747,336 747,332 748,331 756,331 758,329 768,329 776,337 778,337 780,339 788,339 790,337 796,337 798,339 804,339 807,342 807,348 809,350 809,356 811,358 811,364 814,367 828,367 830,369 838,369 839,370 839,372 841,374 841,378 843,380 843,382 857,396 857,398 862,403 864,403 866,405 868,405 870,407 872,407 873,408 873,410 872,411 870,411 868,413 820,413 819,414 819,420 817,422 817,426 822,431 824,431 828,435 830,435 832,437 836,437 837,438 835,440 834.6,444.2 827.6,449.6 822,450.1 818.8,446.5 813.6,435.5 814.2,430.3 812.8,420.9 811.6,422.5 811.5,425.9 803.8,424.9 807.1,427.5 810.6,428.1 812.4,430.5 812.6,434.4 809.1,436.7 809.4,438.7 811.4,441.1 808.9,441.8 808.2,445.5 810,449 809.7,450.3 812.6,454.8 813.1,457 812.4,460 806.1,466.1 802.7,472.5 800.8,472.9 799,471.2 798.4,468.7 798.9,467 802.1,462.9 796.8,465.8 794,463 793.7,458.5 796.1,453.9 793.3,456.2 792.5,459.1 792.8,461.8 775,444 775,442 769,436 769,434 765,432 765,424 764,423 758,423 756,425 754,425 752,423 750,423 748,421 740,421 738,419 732,419 731,418 731,410 729,408|810.1,443.1 812.6,442.3 814.7,443.8 816.4,448.9 819.9,453.4 818.9,462.8 817.5,464.9 812.8,465.9 810.4,465.6 814.8,458 814.1,451.7 811.7,449.5|824.7,464.5 825.6,452.4 828.4,459.3 827,462.8"},"calcutta":{"c":[759.8,458.1],"r":"729,464 731,462 731,452 734,449 736,449 738,447 742,447 746,443 748,443 752,439 754,439 758,435 760,435 764,431 766,433 768,433 769,434 769,436 775,442 775,444 792.9,462.5 791.4,468 790,469.9 787.5,471.1 784.8,474.3 784.3,468 782.6,459.5 782.2,461.3 783.1,470 781.7,472.8 779.1,475.6 777,476 775.9,475.6 772.1,471.2 770.9,464.8 770.2,469.4 768.1,469.3 770,472.3 770.9,477.6 767,477.6 765.7,475 765,477.4 762.6,479.6 761.3,477.3 761.2,475.3 762.5,467.3 761.6,465.9 760.3,465.6 759.8,464 757.8,472.4 758.7,475.8 758.3,477.4 754.6,478.8 750.3,474.6 749.3,478.5 745.8,478.1 744,476.4 747.4,466.6 747.8,463.5 742.3,459.8 740.9,456.6 741.5,460.1 746.8,464 743.9,467.5 741.1,472.6 737.8,475.5 733.8,477.6 733,477.8 733,470 731,468 731,466"},"burdwan":{"c":[719.8,450.1],"r":"683,462 685,460 685,458 699,444 699,442 703,438 703,436 705,434 705,432 710,427 712,427 714,425 722,425 724,423 726,423 730,419 738,419 740,421 748,421 750,423 752,423 754,425 756,425 758,423 764,423 765,424 765,430 760,435 758,435 754,439 752,439 748,443 746,443 742,447 738,447 736,449 734,449 731,452 731,462 729,464 731,466 731,468 733,470 733,477.8 720.5,481 710,481 708,483 700,483 696,479 694,479 685,470 685,468 683,466"},"chittagong":{"c":[859.9,455.2],"r":"834.6,453.7 835.8,449.5 838.6,456.4 837.3,457.2 836.1,456.5|835,440 838,437 844,437 846,435 848,435 850,433 852,433 858,427 860,429 862,429 864,431 866,431 868,433 870,433 872,435 874,435 876,437 878,437 881.9,440.9 879.6,446.6 881.9,457 881.6,460.8 878.7,462.2 876.6,467.4 875,467.9 873.6,467.2 871.3,464.5 869.1,463.7 867.5,467.2 866,468.2 866.6,483 867.5,487.7 865.9,488.9 865.1,487.3 859.5,483.8 858,484.1 855.4,488.1 856.3,493.3 857.6,494.8 859.3,502.6 852,491.5 850.7,476.7 848.2,470.9 845.8,460.9 846.8,457.3 845,458.8 842.3,452.8 837.8,446.9 836.5,444.2 836.4,441.7 835,443.6|846.6,476 848.7,475.6 849.2,476.7 849.2,481.8 847.5,482 846.7,481.1|860,784.7 862.6,781.5 864.3,780.7 866,786 863.3,791 860.4,790.3 860.7,787.4|864.9,753.8 865.8,752.2 866.9,751.7 868.8,745 869.3,744.3 871.8,744.1 871.5,741.9 870,740.4 870,735.3 871,731.8 870.4,728.7 872.3,726 873,722.5 872.4,721.5 873.8,716.2 873.7,712.7 875.5,709.2 879.2,707.5 879.6,711.5 877.9,713.3 879.5,715.7 879.3,716.5 877.6,720.1 876.2,720.9 874.4,724.2 876.6,726.8 877.2,735.4 875.7,737.8 873.8,738.3 874.2,744 870.6,750.5 872,752.5 872,753.7 871.1,760.3 869.4,763.7 866.1,758.1|866.6,767.2 867.6,766.1 867.8,763.8 869.1,765.1 869.2,767.3 867.9,767.9|869.8,827.1 871.7,826.1 872.4,827.9 871.8,828.9 870.5,829.1|879.2,852.5 880.2,850.5 882.1,854.2 880.7,854|885.9,861 886.5,859.8 887.7,859.5 889.2,861.4 889.5,863.3 887.4,863.3|889.8,855.3 890.9,853.9 891.8,854.2 891.3,855.6 892,858.4 890.8,859.5"},"orissa":{"c":[669.8,498.2],"r":"631,486 633,484 633,482 640,475 642,475 646,471 648,471 651,468 651,454 652,453 654,455 660,455 662,457 676,457 683,464 683,466 685,468 685,470 694,479 696,479 700,483 708,483 710,481 720.5,481 718.2,482 714.2,486 711.7,489.7 711.2,493.5 713.9,503.9 714.8,505.2 709.1,513.3 708.8,516.4 702,520.4 698.7,525.2 696.5,523.8 695.1,523.8 696.9,525.7 696.1,527.7 694.3,528.4 677,534.2 674.9,534.1 676.6,532.5 676.5,529.2 673.9,528.4 668.2,532.3 665.9,536.2 666.4,537 667.7,536.8 671.5,534.6 673.3,535.2 673.4,536.1 668.4,539 662,539 660,537 658,537 656,535 654,535 651,532 651,528 649,526 649,522 648,521 646,521 640,527 634,527 631,524 631,500 633,498 633,496 631,494"},"assam":{"c":[895.7,336.5],"r":"807,336 809,334 809,328 812,325 820,325 822,323 824,323 826,321 834,321 836,319 842,319 844,321 850,321 852,323 856,323 858,325 860,325 862,327 864,327 866,329 876,329 879,326 879,324 881,322 881,316 879,314 879,304 877,302 877,298 875,296 875,294 871,290 871,288 869,286 871,283.4 874.3,281.7 880.7,276.4 883.1,270.5 884.3,269.4 895.4,267.5 898.1,266.3 903.8,262.3 904.9,260.8 905,259.2 907.5,258.7 912.4,253.5 917.1,251.3 921.3,248.3 924.3,250.1 925.3,252.5 931.5,253.3 939.1,256.4 942,256.8 945.5,253.3 945.4,251.5 950.6,248.3 959.5,244.1 962,246.2 964.8,250.4 968.1,250.2 967.6,251.4 961.8,255.4 962.2,260.3 962.9,260.7 967.8,257.1 970.3,256.4 971.1,257.2 971.3,259.2 974.2,265.2 969.2,270.1 967.4,272.6 967.4,274.3 966.1,276 969,277.4 970.1,276.2 974.7,274.5 979.4,277.4 984.9,278.3 987.6,277.4 994.2,282 993.7,286 994.7,287.7 994.6,290.6 993.8,291.5 991.6,292 984.5,297.9 982.1,301.3 982.8,305.7 988.3,314.1 988.3,315.6 986.5,316 984.3,315.1 982.2,313.7 980.1,310.1 978.2,309 976.5,308.8 963.7,311.2 960.2,312.5 956,317.7 944,326.5 935,331.3 933.1,335 932.8,338.8 933.3,343.5 935.1,348 931.9,351.9 931.3,356.2 930,358.3 925.8,363.7 922.5,365.5 920.1,369.6 919.4,372.7 922.7,375.1 923.6,377.7 920.3,386.1 915.3,393.6 912.4,399.3 908,412.5 906.5,412.6 895.9,408.7 890.9,409.7 887.1,406.7 886.3,407 885.8,408.2 888.7,418.3 887.4,434.4 885.8,437.4 884.3,437.9 881.9,437.4 881.9,440.9 878,437 876,437 874,435 872,435 870,433 868,433 866,431 864,431 862,429 860,429 858,427 852,433 850,433 848,435 846,435 844,437 832,437 830,435 828,435 824,431 822,431 817,426 817,422 819,420 819,414 820,413 868,413 870,411 872,411 873,410 873,408 872,407 870,407 868,405 866,405 864,403 862,403 857,398 857,396 843,382 843,380 841,378 841,374 839,372 839,370 838,369 830,369 828,367 814,367 811,364 811,358 809,356 809,350 807,348"},"nepal":{"c":[639.6,280],"r":"527,258 535,250 535,248 537,246 537,236 547,226 547,224 552,219 553.1,219.5 553.8,221.8 556.5,225.8 558.2,225.7 560.4,224 564.7,216.4 570.9,214.8 581.7,216.7 584.8,223.3 586.4,224.9 593.6,228.7 603.5,236.8 607.9,238.8 611.7,238.9 617,244.3 623.3,252.3 625.6,252.1 632.8,249.3 637.3,251.2 640.7,260.7 656,271.5 657.6,271.7 663.4,270 665.8,270.5 663.9,277.3 664.8,279 672.5,280.2 679.8,280.2 684.2,284.5 687.2,290.9 688.4,291.4 690.2,290.7 690.6,286.1 692.2,285.1 694.4,288 699.6,290.8 702.5,289.8 703.5,286 707.1,285.8 708.8,288 716.1,290.8 719.3,293.6 723.4,294.1 732.3,294.3 740.7,292 745.4,292.6 745.4,290.7 746.3,290.2 754,288.3 758.1,285.8 762.9,287.4 764.2,288.4 765.4,292.7 762.7,303.3 763.1,306.1 766.5,309.5 768.1,305 771,302.5 771,312 769,314 769,322 767,324 767,328 766,329 758,329 756,331 748,331 746,333 714,333 712,335 710,333 706,333 704,331 702,331 700,329 698,329 691,322 691,320 689,318 689,316 687,314 687,312 686,311 684,313 682,313 678,317 668,317 666,319 664,317 662,317 657,312 657,310 652,305 650,305 648,303 644,303 642,301 638,301 636,299 634,299 632,297 628,301 608,301 604,297 602,297 597,292 597,290 588,281 578,281 576,283 554,283 552,285 548,285 541,278 541,276 527,262"},"bhutan":{"c":[818.8,309.5],"r":"767,324 769,322 769,314 771,312 771,302.5 773.8,297.5 784,285.3 789.8,282.9 791.5,280.8 793.8,279.7 796,279.1 805.9,281.2 806.3,282.1 805.5,285.8 806,286.2 815.8,286.5 821,287.8 824.1,289.6 825.6,289.4 829.6,286.5 830.9,286.3 833.4,288 839.8,290.1 840.8,291 840.6,296 848.1,296.9 849.9,296.9 853.2,294.5 857.2,293.5 861.7,294 865.3,292.4 868.4,290.2 869.1,287.9 867.9,286.8 868.1,285.8 871,283.4 869,286 871,288 871,290 875,294 875,296 877,298 877,302 879,304 879,314 881,316 881,322 879,324 879,326 876,329 866,329 864,327 862,327 860,325 858,325 856,323 852,323 850,321 844,321 842,319 836,319 834,321 826,321 824,323 822,323 820,325 812,325 809,328 809,334 807,336 807,340 806,341 804,339 798,339 796,337 790,337 788,339 780,339 778,337 776,337 767,328"},"rajputana":{"c":[350.8,325.1],"r":"245,344 247,342 247,340 249,338 249,330 247,328 247,324 250,321 256,321 258,319 260,319 263,316 263,314 265,312 265,308 267,306 267,304 276,295 278,295 280,293 282,293 284,291 286,291 291,286 291,284 293,282 293,280 296,277 298,277 303,272 303,270 306,267 308,267 310,265 312,265 314,263 318,263 320,261 322,261 324,259 326,259 328,257 332,257 336,253 338,253 340,251 346,251 348,249 350,249 352,247 354,247 355,246 355,244 372,227 374,227 376,225 380,225 386,219 388,219 390,221 394,221 396,223 398,223 400,225 404,225 406,227 408,227 414,233 416,233 421,238 421,240 423,242 423,248 421,250 421,254 419,256 419,292 422,295 424,295 426,297 428,297 429,298 429,306 431,308 431,312 433,314 433,316 435,318 435,320 437,322 437,324 439,326 439,328 441,330 441,332 443,334 443,340 441,342 441,344 439,346 439,348 437,350 437,352 439,354 439,364 437,366 437,376 435,378 435,380 434,381 426,381 424,383 420,383 418,385 412,385 410,387 404,387 402,389 398,389 396,391 390,391 385,396 385,398 381,402 381,404 379,406 379,410 377,412 377,414 374,417 366,417 364,415 362,415 360,413 358,413 346,401 344,401 342,399 340,399 338,397 336,397 328,389 326,389 324,387 316,387 314,385 312,385 308,389 306,389 298,397 296,397 292,401 288,401 286,399 280,399 278,397 274,397 271,394 271,392 262,383 260,383 257,380 257,378 255,376 255,374 253,372 253,370 249,366 249,364 247,362 247,360 245,358"},"gujarat":{"c":[295.5,440.4],"r":"204.5,414.5 215,404 215,402 220,397 252,397 254,395 272,395 274,397 278,397 280,399 286,399 288,401 292,401 296,397 298,397 306,389 308,389 312,385 314,385 316,387 324,387 326,389 328,389 336,397 338,397 340,399 342,399 344,401 346,401 358,413 360,413 362,415 364,415 366,417 374,417 375,418 375,420 373,422 373,434 371,436 371,442 369,444 369,448 367,450 367,458 369,460 369,464 371,466 371,474 367,478 367,480 366,481 348,481 346,479 342,479 340,477 336.3,477 340.5,474.8 333.2,476.6 331.6,476.6 330,475 325.5,475 326.5,471.1 329.4,468.4 324.6,468.2 325.4,462.8 327.5,461.7 332.3,460.7 326.4,459.4 322.8,460.3 315.4,459.7 318.7,462 318,464.9 317.1,466.7 313.1,469.9 311.5,472.7 315.1,474.1 316.2,475.4 317.5,477.4 317.4,481.2 311,492 298.9,497.4 294.2,500.3 284.1,504.1 280.2,504.8 276,504 269.5,501.2 259.9,493.8 249.7,481.9 234.7,467.7 229.7,461.8 228.7,459 229,456.3 230.9,454.8 233,455.4 234.8,457.7 237,459.2 244.4,455.6 247.2,455.8 249.1,454 251.6,454.3 256.6,451.5 261.3,450.8 268.4,439.2 270.3,438.2 269.7,435.7 268.2,436 265.7,440.1 263.3,439.1 259.7,439.9 252.4,442.5 249.4,444.9 247.5,445.3 235.9,442.8 224.5,436.7 219.8,432.7 213.8,421.5 214.7,419.8 223.5,413.2 215.9,416.3 211.8,420.2 208.8,420.8 207,413.1 205.6,416.2"},"surat":{"c":[346.8,490.7],"r":"325.1,476.3 325.5,475 330,475 331.6,476.6|327.1,483.2 332.3,478.6 336.3,477 340,477 342,479 346,479 348,481 364,481 367,484 365,486 365,490 363,492 363,494 359,498 359,500 353,506 353,510 352,511 340,499 333.5,499 332.4,493.1 330.8,492.8 329.2,491.4 327.4,485.8 330.3,482.9"},"malwa":{"c":[432.9,419.1],"r":"367,450 369,448 369,444 371,442 371,436 373,434 373,422 375,420 375,416 377,414 377,412 379,410 379,406 381,404 381,402 385,398 385,396 390,391 396,391 398,389 402,389 404,387 410,387 412,385 418,385 420,383 424,383 426,381 434,381 435,380 435,378 437,376 437,366 439,364 439,354 437,352 437,350 439,348 439,346 441,344 441,342 443,340 443,338 444,337 452,337 454,339 458,339 460,337 472,337 475,340 475,342 482,349 484,349 487,352 487,356 485,358 485,360 483,362 483,366 479,370 479,372 477,374 477,378 473,382 473,390 471,392 471,400 469,402 469,412 474,417 476,417 478,419 480,419 482,421 484,421 489,426 489,434 491,436 491,438 493,440 493,446 491,448 491,450 488,453 486,453 481,458 481,462 479,464 479,466 478,467 476,467 474,469 466,469 464,467 462,467 460,465 454,465 448,471 446,471 444,473 422,473 420,475 418,473 416,473 414,475 412,475 410,477 406,477 404,479 400,479 398,477 390,477 388,475 386,475 384,473 378,473 376,471 372,471 371,470 371,466 369,464 369,460 367,458"},"bundelkhand":{"c":[513.6,387.4],"r":"469,402 471,400 471,392 473,390 473,382 477,378 477,374 479,372 479,370 483,366 483,362 485,360 485,358 487,356 487,352 488,351 490,351 492,349 498,349 500,351 504,351 506,353 508,351 514,351 515,352 515,354 517,356 517,360 520,363 524,363 528,359 534,359 536,361 544,361 549,366 549,370 551,372 551,374 557,380 557,382 561,386 561,388 563,390 563,392 565,394 565,402 556,411 554,411 552,415 550,413 532,413 530,411 526,411 524,409 520,409 518,407 516,409 512,409 510,411 506,411 496,421 494,421 492,423 490,423 488,425 484,421 482,421 480,419 478,419 476,417 474,417 469,412"},"nagpur":{"c":[552.3,484.6],"r":"423,520 425,518 425,514 427,512 427,510 436,501 438,501 439,500 439,498 443,494 443,490 445,488 445,482 447,480 447,472 454,465 460,465 462,467 464,467 466,469 474,469 476,467 478,467 479,466 479,464 481,462 481,458 486,453 488,453 491,450 491,448 493,446 493,440 491,438 491,436 489,434 489,424 490,423 492,423 494,421 496,421 506,411 510,411 512,409 516,409 518,407 520,409 524,409 526,411 530,411 532,413 550,413 552,415 553,414 553,412 554,411 556,411 565,402 565,400 566,399 574,399 576,397 582,397 589,404 589,408 591,410 591,412 593,414 593,416 596,419 598,419 600,421 604,421 606,423 616,423 618,425 620,425 622,427 632,427 647,442 647,444 649,446 649,450 651,452 651,468 648,471 646,471 642,475 640,475 633,482 633,484 631,486 631,494 633,496 633,498 631,500 631,524 633,526 622,537 620,537 611,546 611,550 609,552 609,556 601,564 601,566 594,573 586,573 584,571 580,571 578,569 552,569 550,567 548,567 544,563 542,563 540,561 520,561 519,560 519,550 517,548 517,544 515,542 515,536 513,534 513,532 502,521 500,523 496,523 494,521 492,521 489,518 489,516 488,515 486,515 484,513 482,513 480,511 476,515 474,515 472,517 454,517 452,519 448,519 446,521 444,521 436,529 434,529 432,531 423,522"},"deccan":{"c":[391.2,557.7],"r":"347,558 351,554 351,552 357,546 357,538 355,536 355,530 353,528 353,524 351,522 351,512 353,510 353,506 359,500 359,498 363,494 363,492 365,490 365,486 367,484 365,482 367,480 367,478 371,474 371,472 372,471 376,471 378,473 384,473 386,475 388,475 390,477 398,477 400,479 404,479 406,477 410,477 412,475 414,475 416,473 418,473 420,475 422,473 444,473 446,471 447,472 447,480 445,482 445,488 443,490 443,494 439,498 439,500 438,501 436,501 427,510 427,512 425,514 425,518 422,521 412,521 410,523 402,523 400,521 394,521 392,519 384,519 379,524 379,526 377,528 377,532 375,534 375,536 373,538 373,542 374,543 376,543 378,545 386,545 388,543 390,545 394,545 396,547 400,547 402,549 404,549 411,556 411,560 413,562 413,564 415,566 415,568 417,570 417,574 419,576 419,580 421,582 421,596 415,602 415,606 417,608 417,630 416,631 414,631 412,633 406,633 404,635 400,635 399,636 399,644 401,646 401,650 403,652 403,654 409,660 409,662 411,664 411,666 413,668 413,670 408,675 396,675 389,668 389,666 376,653 374,653 373,652 375,650 375,644 377,642 377,638 379,636 379,632 381,630 381,628 383,626 382,625 376,625 374,623 366,623 363,620 363,618 361,616 361,610 373,598 373,596 366,589 364,589 361,586 363,584 363,582 358,577 356,577 351,572 351,570 349,568 349,560"},"konkan":{"c":[347.7,568.2],"r":"328.6,530.2 329.6,523.1 334.3,509.1 334.7,506 333.5,499 340,499 351,510 351,522 353,524 353,528 355,530 355,536 357,538 357,546 351,552 351,554 347,558 349,560 349,568 351,570 351,572 356,577 358,577 363,582 363,584 361,586 364,589 366,589 373,596 373,598 361,610 361,616 363,618 363,620 365,622 365,624 361,628 361,630 359,632 359,634 355,638 355,645.1 350.3,637.5 346.6,626 344,605.2 341.5,595.9 341.7,593.2 337.3,579.7 335.3,566.1 334.1,564.2 334.8,560.3 337.7,553.4 336.7,549.6 334.8,553.6 333,554.7 332.1,551.7 332,546.8 332.4,545.4 337.2,546.1 331.8,543.7 330.9,541.1 332,539.1 330.1,537.5"},"hyderabad":{"c":[467.2,578.3],"r":"373,538 375,536 375,534 377,532 377,528 379,526 379,524 384,519 392,519 394,521 400,521 402,523 410,523 412,521 422,521 432,531 434,529 436,529 444,521 446,521 448,519 452,519 454,517 472,517 474,515 476,515 480,511 482,513 484,513 486,515 488,515 489,516 489,518 492,521 494,521 496,523 500,523 502,521 513,532 513,534 515,536 515,542 517,544 517,548 519,550 519,560 520,561 540,561 542,563 544,563 549,568 549,592 542,599 540,599 530,609 528,609 526,611 524,611 520,615 518,615 513,620 513,624 509,628 509,630 504,635 502,635 500,637 498,637 491,644 491,646 488,649 484,649 482,647 480,647 468,635 465,638 465,642 463,644 463,646 455,654 455,656 452,659 450,659 448,657 446,657 444,655 442,655 437,650 437,648 435,646 435,644 433,642 433,640 429,636 429,632 428,631 418,631 417,630 417,608 415,606 415,602 421,596 421,582 419,580 419,576 417,574 417,570 415,568 415,566 413,564 413,562 411,560 411,556 404,549 402,549 400,547 396,547 394,545 390,545 388,543 386,545 378,545 376,543 374,543 373,542"},"circars":{"c":[583.6,589.7],"r":"509,628 513,624 513,620 518,615 520,615 524,611 526,611 528,609 530,609 540,599 542,599 549,592 549,568 550,567 552,569 578,569 580,571 584,571 586,573 594,573 601,566 601,564 609,556 609,552 611,550 611,546 620,537 622,537 632,527 640,527 646,521 648,521 649,522 649,526 651,528 651,532 654,535 656,535 658,537 660,537 662,539 668.4,539 655.3,550.4 653.1,555 637.4,574.2 625.2,580.5 612.9,593.6 606.8,597.8 596.5,603.1 590.2,608.1 588.1,612.6 590.2,616.9 589.3,620.3 587.5,623.2 584.3,625.3 574.1,629.7 564.4,628.7 561.2,629.5 557.1,640 554.3,642.3 552.9,645.7 549.9,645.1 548.8,645.5 547.6,642.7 543.9,641.9 536.9,644.8 534.4,647.1 533,650 532,649 530,649 528,647 522,647 520,645 518,645 515,642 515,640 511,636 511,634 509,632"},"ceded":{"c":[463.2,669.8],"r":"399,636 400,635 404,635 406,633 412,633 414,631 428,631 429,632 429,636 433,640 433,642 435,644 435,646 437,648 437,650 442,655 444,655 446,657 448,657 450,659 452,659 455,656 455,654 463,646 463,644 465,642 465,638 468,635 480,647 482,647 484,649 488,649 491,646 491,644 498,637 500,637 502,635 504,635 505,636 505,640 503,642 503,652 505,654 505,656 507,658 507,660 509,662 509,666 511,668 511,676 513,678 511,680 511,692 509,694 509,700 507,702 507,704 505,706 505,708 500,713 490,713 488,711 486,711 482,707 480,707 478,705 474,705 472,707 470,705 464,705 458,699 456,699 451,694 451,692 449,690 449,688 446,685 434,685 432,683 430,683 422,675 420,675 418,673 416,673 413,670 413,668 411,666 411,664 409,662 409,660 403,654 403,652 401,650 401,646 399,644"},"carnatic":{"c":[501.5,749.9],"r":"455,798 456,797 458,797 460,795 474,795 476,797 480,797 482,799 484,799 486,797 488,797 489,796 489,794 477,782 477,780 475,778 475,776 471,772 472,771 476,771 478,773 490,773 492,771 498,771 499,770 499,768 497,766 497,764 493,760 493,758 491,756 491,752 501,742 501,740 505,736 505,734 507,732 507,728 502,723 500,723 491,714 492,713 500,713 505,708 505,706 507,704 507,702 509,700 509,694 511,692 511,680 513,678 511,676 511,668 509,666 509,662 507,660 507,658 505,656 505,654 503,652 503,642 505,640 505,634 508,631 511,634 511,636 515,640 515,642 518,645 520,645 522,647 528,647 530,649 532,649 533,650 529.3,657.9 527.9,664.9 531.3,681.5 531.1,685.2 529.6,689 530.3,693.2 532.6,698.8 534.1,706.9 533.4,707.6 530.7,702.8 528.2,705.8 529.6,707.9 531.8,709.2 529,712 529,714 526,717 524,717 523,718 523,726 521,728 521,748 523,750 519.8,762 520.9,765.6 518.2,769.2 521.1,768.5 522.1,770.4 522.4,780.6 520,783 510,783 508,781 506,781 502,777 501,778 501,792 503,794 503,798 505,800 505,802 503,804 504,805 506,805 499.4,814 497.3,820.3 500,823.6 506.9,824.9 509.1,825.8 510.6,827.4 505.3,825.7 498.9,825.3 483.9,829.8 477.7,835.7 475.9,846.1 474.2,849.5 466.3,854.8 461,856.7 463,854 463,838 461,836 461,834 459,832 459,828 462,825 464,825 468,821 470,821 473,818 471,816 471,814 461,804 461,802 460,801 458,801"},"tanjore":{"c":[510.9,789.7],"r":"501,778 502,777 506,781 508,781 510,783 520,783 522.4,780.6 522.2,796.4 517.5,797.1 513.8,796.3 510,796.9 508,798.3 506.3,800.5 506,805 504,805 503,804 505,802 505,800 503,798 503,794 501,792|893.6,878.5 896.2,876.1 897.3,877.5 894.7,880.1|895.2,883.5 896,882.2 899.7,880.8 900.7,881.6 902.6,887.9 901.5,891.8 899.9,894.1 896.7,887.2 895.2,886.8"},"jagir":{"c":[527.5,728.1],"r":"521,728 523,726 523,718 524,717 526,717 529,714 529,712 531.8,709.2 534.3,710.5 535.8,712.6 532.7,731.2 530.3,737.8 526,743.8 523,750 521,748"},"mysore":{"c":[437.9,717],"r":"395,676 396,675 408,675 412,671 414,671 416,673 418,673 420,675 422,675 430,683 432,683 434,685 446,685 449,688 449,690 451,692 451,694 456,699 458,699 464,705 470,705 472,707 474,705 478,705 480,707 482,707 486,711 488,711 491,714 491,716 487,720 487,722 486,723 484,723 479,728 479,736 474,741 472,741 470,743 460,743 459,744 459,746 457,748 457,750 452,755 430,755 424,749 422,749 420,747 414,747 412,745 408,745 406,743 404,743 401,740 401,734 403,732 403,724 407,720 407,718 405,716 405,714 407,712 407,710 409,708 409,706 411,704 411,702 409,700 409,698 407,696 407,694 403,692 403,690 399,686 399,684 395,680"},"baramahal":{"c":[483.7,746.9],"r":"455,752 457,750 457,748 459,746 459,744 460,743 470,743 472,741 474,741 479,736 479,728 484,723 486,723 487,722 487,720 492,715 500,723 502,723 507,728 507,732 505,734 505,736 501,740 501,742 491,752 491,756 493,758 493,760 497,764 497,766 499,768 499,770 498,771 492,771 490,773 478,773 476,771 474,771 467,764 467,760 462,755 456,755 455,754"},"coimbatore":{"c":[455.4,776.9],"r":"429,756 430,755 452,755 454,753 456,755 462,755 467,760 467,764 473,770 471,772 475,776 475,778 477,780 477,782 489,794 489,796 488,797 486,797 484,799 482,799 480,797 476,797 474,795 460,795 458,797 450,797 448,795 442,795 441,794 441,792 437,788 437,786 431,780 431,778 433,776 433,762 431,760 431,758"},"malabar":{"c":[416.3,762.4],"r":"389.5,733 394,729 396,729 400,725 402,725 403,726 403,732 401,734 401,740 404,743 406,743 408,745 412,745 414,747 420,747 422,749 424,749 429,754 429,756 431,758 431,760 433,762 433,776 431,778 431,780 437,786 437,788 436,789 434,789 432,791 430,791 422.9,798.1 416.4,783.8 411.1,767.9 405.6,758.5 400,751.4 396.8,748.7"},"canara":{"c":[382.7,677.6],"r":"355,638 359,634 359,632 361,630 361,628 366,623 374,623 376,625 382,625 383,626 381,628 381,630 379,632 379,636 377,638 377,642 375,644 375,650 373,652 374,653 376,653 389,666 389,668 395,674 395,680 399,684 399,686 403,690 403,692 407,694 407,696 409,698 409,700 411,702 411,704 409,706 409,708 407,710 407,712 405,714 405,716 407,718 407,720 402,725 400,725 396,729 394,729 390,733 385.3,720.5 382.6,704.1 380.9,699 377.9,693.6 374.8,681.1 363.2,664.9 361.4,658.4 359.2,655.9 362.7,655.9 358.3,650.9 359.9,648.5 357.3,648.6 355.9,647.1 355,645.1"},"travancore":{"c":[446.8,820.6],"r":"422.9,798.1 430,791 432,791 434,789 438,789 441,792 441,794 442,795 448,795 450,797 454,797 458,801 460,801 461,802 461,804 471,814 471,816 473,818 470,821 468,821 464,825 462,825 459,828 459,832 461,834 461,836 463,838 463,854 459.5,857.8 453.6,856 447.2,851.4 433.4,835.3 431.2,828.3 429.3,826.2 427.3,820.3 425.1,807.3 427.8,810 428.7,817.9 429.8,818.4 430.9,818 427.9,807.4 424.5,804.6 423.8,802.9 423.9,799.8"},"ceylon":{"c":[545.5,870.5],"r":"518.6,858.2 519.7,852 519.7,858.6 520.6,859.5 521.3,858.6 522.5,848.8 524.9,841.1 524.6,835.4 528.3,830.1 529.2,826.9 529.7,823.8 528.8,816.9 535.1,819.9 538,819.5 536.9,817.7 533.4,816 527.7,814.9 525.3,812.3 525.6,811 526.1,810.4 533.4,810.9 536.7,815.1 545.7,822.7 550.7,830.4 551.7,833.4 554,834.5 558.8,841.9 559.6,846.2 562.5,847.1 563.6,848.2 565.2,856.8 571.5,865.9 571.9,868.6 575.9,875.5 577.1,879.4 576.8,889.9 572.7,900.5 570.7,902.8 563.8,907.8 546.1,914.9 539.9,915.7 533.7,914.1 529.1,910.2 522.7,891.8 520.9,871.3"},"afghanistan":{"c":[149.4,102.7],"r":"-0.4,96.5 3.9,89.5 10.5,89.1 6.1,82.6 12.2,78.2 12.4,76.3 15.7,71.5 15.4,69.3 17.5,63.7 16.2,57.7 18.6,56.4 21,49.8 20.6,46.2 22.9,46 24.9,48.7 30.2,52.5 40.1,52.1 46.3,57.2 48.8,61.1 53,58.4 57,59.1 59.1,58.3 69,52 70.7,45.7 72,44.3 70.4,39.7 71,38.7 75.6,38.3 90.8,33.2 94.8,33.2 97,29.8 104.2,26 108.3,22.2 109.8,19.3 116.6,-4.5 123.9,-8.1 136.5,-8.5 138.8,-15.8 142.1,-19.3 151.5,-14.1 161.3,-11.7 170.9,-12.6 177.4,-11.4 180.8,-7.9 184.1,-7.1 189.5,-9.1 191.9,-7.5 194.4,-7.7 195.9,-6.8 198,-2.2 201.4,0.9 204.3,1.7 208.2,-0.7 209.6,-0.4 210.5,-3 213,-4.6 217.3,-6.2 220.6,-8.8 224.7,-9.2 227.1,-11.3 228.4,-11 236.7,-3.6 237.7,-3.9 240.7,-7.1 240.3,-13.5 240.9,-16.5 242.8,-18.8 251.7,-20.7 254.9,-20.4 257.7,-18.6 259.7,-18.4 261.6,-19.7 263.3,-22.6 262.3,-31.4 265,-33.5 270.1,-40 292.4,-40 291,-31.2 292.1,-30.6 298.4,-31.7 299.2,-30.9 295.2,-4.3 297.8,5.2 299.6,9 301.4,10.2 305.1,10.3 314.7,3.3 320.2,0.6 328.3,-1 331,-5.8 334.7,-9.1 347.8,-15.7 350.5,-16 356.9,-14.2 356.8,-11.2 354.4,-8.9 355.2,-8.1 357.7,-7.8 369,-11.2 371.5,-14.1 373.9,-14.2 378.6,-12.9 382.3,-13.4 388.5,-7.8 385.2,-8.4 384.1,-9.8 374.5,-5.3 379.1,-0.8 365.6,5.9 358.3,3.8 327.3,5.7 314.7,10.1 313.1,12.4 304.3,19.1 300.3,19 289.8,29.5 288.5,32.2 292.8,35.6 295,39.1 297.5,47 298.9,48.7 299.7,53.3 298.2,57.2 300.3,60.7 295.8,67.8 291.4,71.1 285.3,79.9 282.6,82.2 286.1,87.4 286,95.6 284.9,97.9 274.1,101.1 265.3,100.8 256.3,97.8 253.5,99.3 252.9,102.8 260.1,111.9 264.2,120 263.5,122.6 254.4,128.3 244.9,129.8 243,131.3 241.7,137.2 240.4,139.5 240.5,142.1 236,150 237.1,165.9 231.7,172.2 226,175.5 223.7,175.2 218.6,170.2 214.4,171.7 206.9,170.2 203,174.2 195.5,178.2 191.1,179.6 191.6,181.3 195.3,183.6 195.4,184.7 187.7,188.2 183.2,188.7 178.7,187.9 176.2,186.1 173.4,185.9 170.9,187.2 168.3,189.4 164.6,195 159.2,198.4 157.9,201.8 156.2,207.9 156.8,216.9 154.9,223.5 155.1,225.5 157,227.9 156.2,229.4 153.3,232 126.4,240.1 105.1,241.1 99.2,243.7 97.2,245.8 82.8,242.5 53.4,245.3 9.2,231.3 34.7,200.9 35.5,193.3 33.9,186.6 31.3,183.5 8.7,179.9 7.8,164.3 8.9,156 2.1,132.1 1.7,127.5 11.3,115.6 11,114.5 4.2,113.8 0.3,111.2 -0.4,108.9 0.7,104.6"},"persia":{"c":[-4.5,207.2],"r":"-40,-20.9 -32.4,-17.3 -30.6,-11.3 -25.4,-6.1 -14.9,-1.4 -11.8,1.2 -4.3,12.2 16.7,12.1 18.1,14.4 17.8,19.1 19.3,30.3 17.6,34.3 20.3,38 19.8,43.4 21,49.8 18.6,56.4 16.2,57.7 17.5,63.7 15.4,69.3 15.7,71.5 12.4,76.3 12.2,78.2 6.1,82.6 10.5,89.1 3.9,89.5 -0.4,96.5 0.7,104.6 -0.4,108.9 0.3,111.2 2,112.9 11,114.5 11.3,115.6 1.7,127.5 2.1,132.1 8.9,156 7.8,164.3 8.7,179.9 31.3,183.5 33.9,186.6 35.5,193.3 35.4,198.3 34.7,200.9 9.2,231.3 22.1,246.4 22.7,249.8 30.3,264.3 37.5,271.9 50.1,275.9 55.7,281.5 61,281.2 60.5,288.6 62.4,304 61.1,311.5 65.2,312.5 72,311.4 75.6,314.5 74.1,316.8 74.3,322.8 72.5,324 71.7,329.7 60.8,330 52.4,332.4 48.9,334.5 47,338.5 43.9,338.2 42.9,339.7 36.3,342.5 33.8,354 31.4,356.8 29.4,373.2 27.9,373.4 24.6,376.2 4.4,370.8 2.3,366.8 0.3,366.2 -2.7,369.9 -12.8,367.7 -16.3,368.4 -18.4,367.2 -23.9,367.1 -28.2,364.8 -34.4,366.4 -40,366.3"}}};
// @geo-end
