'use client';

import { useEffect, useMemo, useState } from "react";
import { csvParse } from "d3-dsv";
import { extent } from "d3-array";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { scaleSequential } from "d3-scale";
import { interpolateRdYlGn } from "d3-scale-chromatic";
import { feature, mesh } from "topojson-client";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiLineString,
} from "geojson";

type CountyFeature = Feature<
  Geometry,
  {
    name: string;
    stateAbbr?: string;
    prosperity?: number | null;
  }
>;

type MapData = {
  counties: CountyFeature[];
  stateBorders: Feature<MultiLineString> | null;
  prosperityById: Map<string, number>;
  valueExtent: [number, number];
};

const stateFipsToAbbr: Record<string, string> = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
};

const normalizeCountyName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(
      /\s+(county|parish|borough|census area|city and borough|city|municipality|district|census district|municipio|island|township|borough and census area)$/u,
      ""
    )
    .replace(/[^a-z0-9]/g, "");

const extractCountyAndState = (entry: string) => {
  const trimmed = entry.trim();
  const stateAbbr = trimmed.slice(-2);
  const countyName = trimmed.slice(0, -3);
  return { countyName: countyName.trim(), stateAbbr: stateAbbr.trim() };
};

const svgWidth = 960;
const svgHeight = 600;

export default function Home() {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projection = useMemo(
    () => geoAlbersUsa().scale(1280).translate([svgWidth / 2, svgHeight / 2]),
    []
  );
  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  useEffect(() => {
    async function loadData() {
      try {
        const [csvResponse, topoResponse] = await Promise.all([
          fetch("/data/modelData.csv").then((res) => {
            if (!res.ok) {
              throw new Error("Unable to read modelData.csv");
            }
            return res.text();
          }),
          fetch("/data/counties-10m.json").then((res) => {
            if (!res.ok) {
              throw new Error("Unable to read counties topology");
            }
            return res.json();
          }),
        ]);

        const parsedRows = csvParse(csvResponse);
        const prosperityLookup = new Map<string, number>();

        for (const row of parsedRows) {
          const countyField = row.county;
          const prosperityValue = row.prosperity_score;
          if (!countyField || prosperityValue === undefined) {
            continue;
          }

          const { countyName, stateAbbr } = extractCountyAndState(countyField);
          const normalizedCounty = normalizeCountyName(countyName);
          const parsedValue = Number.parseFloat(
            Array.isArray(prosperityValue)
              ? prosperityValue[0]
              : prosperityValue
          );

          if (
            !Number.isFinite(parsedValue) ||
            normalizedCounty.length === 0 ||
            stateAbbr.length !== 2
          ) {
            continue;
          }

          prosperityLookup.set(`${normalizedCounty}|${stateAbbr}`, parsedValue);
        }

        const countiesFeatureCollection = feature(
          topoResponse,
          topoResponse.objects.counties
        ) as unknown as FeatureCollection<Geometry, { name: string }>;

        const bordersGeometry = mesh(
          topoResponse,
          topoResponse.objects.states,
          (a, b) => a !== b
        );

        const borders: Feature<MultiLineString> | null = bordersGeometry
          ? {
              type: "Feature",
              geometry: bordersGeometry as MultiLineString,
              properties: {},
            }
          : null;

        const prosperityValues: number[] = [];
        const countiesWithValues: CountyFeature[] = countiesFeatureCollection.features.map(
          (countyFeature) => {
            const countyId = `${countyFeature.id ?? ""}`;
            const stateFips = countyId.slice(0, 2);
            const stateAbbr = stateFipsToAbbr[stateFips];
            const normalizedCounty = normalizeCountyName(
              countyFeature.properties?.name ?? ""
            );
            const lookupKey = `${normalizedCounty}|${stateAbbr}`;
            const prosperity = prosperityLookup.get(lookupKey) ?? null;

            if (prosperity !== null) {
              prosperityValues.push(prosperity);
            }

            return {
              ...countyFeature,
              properties: {
                ...countyFeature.properties,
                stateAbbr,
                prosperity,
              },
            };
          }
        );

        const valueExtent =
          (extent(prosperityValues) as [number, number] | null) ?? null;

        if (!valueExtent) {
          throw new Error(
            "Could not determine prosperity score range for the provided data."
          );
        }

        setMapData({
          counties: countiesWithValues,
          stateBorders: borders,
          prosperityById: prosperityLookup,
          valueExtent,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading the map."
        );
      }
    }

    loadData().catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error while preparing the map."
      );
    });
  }, []);

  const colorScale = useMemo(() => {
    if (!mapData) {
      return null;
    }
    return scaleSequential(interpolateRdYlGn).domain([
      mapData.valueExtent[0],
      mapData.valueExtent[1],
    ]);
  }, [mapData]);

  const legendStops = useMemo(() => {
    if (!mapData || !colorScale) {
      return [];
    }
    const steps = 10;
    const [min, max] = mapData.valueExtent;
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      const value = min + (max - min) * t;
      return {
        value,
        color: colorScale(value),
      };
    });
  }, [colorScale, mapData]);

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-950 px-6 py-10 text-zinc-50">
      <header className="max-w-4xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          County Prosperity Scores Across the United States
        </h1>
        <p className="mt-3 text-base text-zinc-300 sm:text-lg">
          This choropleth map highlights relative prosperity levels per county,
          based on the latest figures from <code>modelData.csv</code>.
        </p>
      </header>

      <main className="flex w-full max-w-5xl flex-col items-center gap-6">
        {error ? (
          <div className="w-full rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!mapData || !colorScale ? (
          <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-center text-sm text-zinc-300">
            Loading county-level prosperity data…
          </div>
        ) : (
          <div className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              role="img"
              aria-label="Choropleth map of prosperity scores by U.S. county"
              className="h-full w-full"
            >
              <g>
                {mapData.counties.map((county) => {
                  const path = pathGenerator(county);
                  if (!path) {
                    return null;
                  }

                  const prosperity = county.properties?.prosperity ?? null;
                  const fill =
                    prosperity !== null && colorScale
                      ? colorScale(prosperity)
                      : "#3f3f46";

                  return (
                    <path
                      key={county.id ?? county.properties?.name}
                      d={path}
                      fill={fill}
                      stroke="#111"
                      strokeWidth={0.25}
                    >
                      <title>
                        {county.properties?.name},{" "}
                        {county.properties?.stateAbbr ?? "N/A"}:{" "}
                        {prosperity !== null
                          ? prosperity.toFixed(3)
                          : "No data"}
                      </title>
                    </path>
                  );
                })}
              </g>

              {mapData.stateBorders ? (
                <path
                  d={pathGenerator(mapData.stateBorders) ?? ""}
                  fill="none"
                  stroke="#111"
                  strokeWidth={0.7}
                />
              ) : null}
            </svg>
          </div>
        )}

        {legendStops.length > 0 ? (
          <section className="flex w-full max-w-4xl flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between text-sm text-zinc-300">
              <span>Lower prosperity</span>
              <span>Higher prosperity</span>
            </div>
            <div
              className="h-3 w-full rounded-full"
              style={{
                background: `linear-gradient(to right, ${legendStops
                  .map((stop) => stop.color)
                  .join(", ")})`,
              }}
            />
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{legendStops.at(0)?.value.toFixed(2)}</span>
              <span>{legendStops.at(-1)?.value.toFixed(2)}</span>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="max-w-4xl text-center text-xs text-zinc-500">
        Prosperity scores are provided per county. Missing counties default to a
        neutral color.
      </footer>
    </div>
  );
}
