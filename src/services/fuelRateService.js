const { DailyDaybook } = require('../models');
const { Op } = require('sequelize');

/**
 * Fuel Rate Service:
 * Manages daily petrol (MS) and diesel (HSD) prices without creating extra tables.
 *
 * In India, fuel pricing is administered by Revenue District (due to state VAT,
 * local development cess, and distance freight from the nearest oil refinery/terminal).
 * Towns and sub-districts (e.g. Madanapalle) are mapped to their official pricing district (Chittoor).
 */

const DEFAULT_RATES = {
  ms_price: parseFloat(process.env.DEFAULT_MS_PRICE || '104.50'),
  hsd_price: parseFloat(process.env.DEFAULT_HSD_PRICE || '91.20'),
};

/**
 * District Aliases & Town Mapping for Andhra Pradesh, Telangana, Karnataka, etc.
 */
const DISTRICT_MAP = {
  // Andhra Pradesh
  madanapalle:   'chittoor',
  annamayya:     'chittoor',
  chittoor:      'chittoor',
  tirupati:      'tirupati',
  kadapa:        'cuddapah',
  cuddapah:      'cuddapah',
  ysr:           'cuddapah',
  anantapur:     'anantapur',
  kurnool:       'kurnool',
  nandyal:       'kurnool',
  nellore:       'nellore',
  ongole:        'prakasam',
  prakasam:      'prakasam',
  guntur:        'guntur',
  vijayawada:    'vijayawada',
  krishna:       'vijayawada',
  vizag:         'visakhapatnam',
  visakhapatnam: 'visakhapatnam',
  rajahmundry:   'east-godavari',
  kakinada:      'east-godavari',
  eluru:         'west-godavari',

  // Telangana
  hyderabad:     'hyderabad',
  secunderabad:  'hyderabad',
  warangal:      'warangal',
  karimnagar:    'karimnagar',
  khammam:       'khammam',
  nizamabad:     'nizamabad',

  // Karnataka & Tamil Nadu
  bangalore:     'bangalore',
  bengaluru:     'bangalore',
  chennai:       'chennai',
  mumbai:        'mumbai',
  delhi:         'delhi',
};

/**
 * Clean district name from user input
 */
const resolveDistrict = (input) => {
  if (!input) return 'chittoor';
  // Strip out (AP), (TS), spaces, punctuation
  const cleaned = input
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim()
    .replace(/[^a-z]/g, '');

  return DISTRICT_MAP[cleaned] || cleaned;
};

/**
 * Auto-fetch live revised petrol and diesel rates for any specific Indian district/city
 */
const fetchLiveMarketRates = async (cityInput) => {
  const rawCity = cityInput || process.env.FUEL_CITY || 'chittoor';
  const district = resolveDistrict(rawCity);

  try {
    const pUrl = `https://www.goodreturns.in/petrol-price-in-${district}.html`;
    const dUrl = `https://www.goodreturns.in/diesel-price-in-${district}.html`;

    const [pRes, dRes] = await Promise.all([
      fetch(pUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
      }),
      fetch(dUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
      }),
    ]);

    if (!pRes.ok || !dRes.ok) {
      console.warn(`[fuelRateService] HTTP ${pRes.status}/${dRes.status} fetching rates for ${district}`);
      return null;
    }

    // Guard: Goodreturns silently redirects non-existent city URLs to generic 'petrol-price.html'
    if (pRes.url.endsWith('petrol-price.html') || dRes.url.endsWith('diesel-price.html')) {
      console.warn(`[fuelRateService] Invalid/redirected district: ${district}`);
      return null;
    }

    const [pHtml, dHtml] = await Promise.all([pRes.text(), dRes.text()]);

    // Extract exact district-level retail selling price (RSP)
    const pMatch = pHtml.match(/Rs\.\s*([0-9]+\.[0-9]{2})/i);
    const dMatch = dHtml.match(/Rs\.\s*([0-9]+\.[0-9]{2})/i);

    if (pMatch && dMatch) {
      const ms = parseFloat(pMatch[1]);
      const hsd = parseFloat(dMatch[1]);

      // Sanity Check: Ensure price is within real Indian fuel market range (> ₹80)
      if (ms < 80 || hsd < 70) {
        console.warn(`[fuelRateService] Price sanity check failed for ${district}: MS ${ms}, HSD ${hsd}`);
        return null;
      }

      return {
        city: rawCity,
        district: district.toUpperCase(),
        ms_price: ms,
        hsd_price: hsd,
        source: `Live District Feed (${district.toUpperCase()})`,
        fetched_at: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn(`[fuelRateService] Could not auto-fetch live rates for ${district}:`, err.message);
  }
  return null;
};

/**
 * Get the latest active rates:
 * 1. Try live auto-fetch for the configured district
 * 2. Fall back to latest recorded DailyDaybook entry
 * 3. Fall back to configured default rates
 */
const getLatestRates = async (options = {}) => {
  const allowLive = options.live !== false && process.env.AUTO_FETCH_RATES !== 'false';
  const targetCity = options.city || process.env.FUEL_CITY || 'chittoor';

  // 1. If live auto-fetch is allowed, attempt live fetch for target district
  if (allowLive) {
    const live = await fetchLiveMarketRates(targetCity);
    if (live) {
      return {
        date: new Date().toISOString().split('T')[0],
        ms_price: live.ms_price,
        hsd_price: live.hsd_price,
        city: live.city,
        district: live.district,
        source: live.source,
        is_live: true,
        is_default: false,
      };
    }
  }

  // 2. Check latest recorded daybook entry
  const latest = await DailyDaybook.findOne({
    attributes: ['entry_date', 'ms_price', 'hsd_price', 'updated_at'],
    order: [['entry_date', 'DESC']],
  });

  if (latest) {
    return {
      date: latest.entry_date,
      ms_price: parseFloat(latest.ms_price),
      hsd_price: parseFloat(latest.hsd_price),
      source: 'Previous Day Record',
      is_live: false,
      is_default: false,
      last_updated: latest.updated_at,
    };
  }

  // 3. System defaults
  return {
    date: new Date().toISOString().split('T')[0],
    ...DEFAULT_RATES,
    source: 'System Defaults',
    is_live: false,
    is_default: true,
  };
};

/**
 * Check fuel rates for a particular date
 */
const getRateByDate = async (date) => {
  if (!date) return getLatestRates();

  const exact = await DailyDaybook.findOne({
    where: { entry_date: date },
    attributes: ['entry_date', 'ms_price', 'hsd_price', 'created_at', 'updated_at'],
  });

  if (exact) {
    return {
      date: exact.entry_date,
      ms_price: parseFloat(exact.ms_price),
      hsd_price: parseFloat(exact.hsd_price),
      source: 'Recorded Daybook',
      is_recorded: true,
      last_updated: exact.updated_at,
    };
  }

  const prev = await DailyDaybook.findOne({
    where: { entry_date: { [Op.lte]: date } },
    attributes: ['entry_date', 'ms_price', 'hsd_price', 'updated_at'],
    order: [['entry_date', 'DESC']],
  });

  if (prev) {
    return {
      date,
      ms_price: parseFloat(prev.ms_price),
      hsd_price: parseFloat(prev.hsd_price),
      source: `Effective from ${prev.entry_date}`,
      is_recorded: false,
      last_updated: prev.updated_at,
    };
  }

  return {
    date,
    ...DEFAULT_RATES,
    source: 'System Defaults',
    is_recorded: false,
    is_default: true,
  };
};

/**
 * Audit log of rate changes across dates (directly from daily_daybook)
 */
const getRateHistory = async (limit = 30) => {
  const records = await DailyDaybook.findAll({
    attributes: ['entry_date', 'ms_price', 'hsd_price', 'created_at', 'updated_at'],
    order: [['entry_date', 'DESC']],
    limit,
    raw: true,
  });

  return records.map((r) => ({
    entry_date: r.entry_date,
    ms_price: parseFloat(r.ms_price),
    hsd_price: parseFloat(r.hsd_price),
    updated_at: r.updated_at,
  }));
};

module.exports = {
  DEFAULT_RATES,
  fetchLiveMarketRates,
  getLatestRates,
  getRateByDate,
  getRateHistory,
};
