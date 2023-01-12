import { readFileSync } from "fs";
import { KmlToGeojson } from ".";

const kmlToGeojson = new KmlToGeojson(false);

const content = readFileSync('./test-kmls/test6.kml', 'utf-8');

const { geojson } = kmlToGeojson.parse(content);

console.log(geojson);