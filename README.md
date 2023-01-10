# kml-to-geojson
Convert KML content to GeoJSON, preserving style and folder data

## Installation
```
npm install kml-to-geojson
```

This project was built in Typescript, so typing is supported out of the box

## Usage
``` typescript
import { KmlToGeojson } from 'kml-to-geojson';
import * as fs from 'fs';

const kmlToGeojson = new KmlToGeojson();
const kmlContent = fs.readFileSync('./my-file.kml', 'utf-8');


const { folders, geojson } = kmlToGeojson.parse(kmlContent);

```