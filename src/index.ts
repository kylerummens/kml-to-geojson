import { Feature, GeoJsonProperties, Point, LineString, Polygon } from 'geojson';
import { DOMParser } from 'xmldom';
const crypto = require('crypto');

export interface KmlFolder {
    folder_id: string;
    name: string;
    parent_folder_id: string;
}

export interface KmlIconStyleProps {
    'icon-color'?: string;
    'icon-opacity'?: number;
    'icon-size'?: number;
    'icon-image'?: string;
    'text-color'?: string;
    'text-opacity'?: number;
    'text-size'?: number;
}

export interface KmlLineStyleProps {
    'line-color'?: string;
    'line-opacity'?: number;
    'line-width'?: number;
}

export interface KmlPolyStyleProps {
    'fill-color'?: string;
    'fill-opacity'?: number;
    'fill-outline-color'?: string;
}

export type KmlStyleProps = KmlIconStyleProps | KmlLineStyleProps | KmlPolyStyleProps;

export type KmlPointFeature<P = GeoJsonProperties> = Omit<Feature<Point, (P & KmlIconStyleProps)>, "bbox">;

export type KmlLineFeature<P = GeoJsonProperties> = Omit<Feature<LineString, (P & KmlLineStyleProps)>, "bbox">;

export type KmlPolyFeature<P = GeoJsonProperties> = Omit<Feature<Polygon, (P & KmlPolyStyleProps)>, "bbox">;

export type KmlFeature<P = GeoJsonProperties> = KmlPointFeature<P> | KmlLineFeature<P> | KmlPolyFeature<P>;

export interface KmlGeojson<P = GeoJsonProperties> {
    type: 'FeatureCollection';
    features: Array<KmlFeature<P>>;
}

export class KmlToGeojson {

    private readonly get1 = (node: Element, tag_name: string): Element | null => {
        const nodes = node.getElementsByTagName(tag_name);
        return nodes.length ? nodes[0] : null;
    }

    private readonly kmlColor = (v: any) => {
        let color, opacity: any;
        v = v || '';
        if (v.substr(0, 1) === '#') { v = v.substr(1); }
        if (v.length === 6 || v.length === 3) { color = v; }
        if (v.length === 8) {
            opacity = parseInt(v.substr(0, 2), 16) / 255;
            color = '#' + v.substr(6, 2) +
                v.substr(4, 2) +
                v.substr(2, 2);
        }
        return { color, opacity: isNaN(opacity) ? undefined : opacity };
    }

    private readonly parsePlacemark = (node: Element, styles: any[], style_maps: any[], folder_id: string) => {
        const name_node = this.get1(node, 'name');
        const description_node = this.get1(node, 'description');
        const point_node = this.get1(node, 'Point');
        const linestring_node = this.get1(node, 'LineString');
        const polygon_node = this.get1(node, 'Polygon');
        const style_url_node = this.get1(node, 'styleUrl');
        const style_id = style_url_node?.textContent;

        const geometry_type = point_node ? 'Point' : linestring_node ? 'LineString' : polygon_node ? 'Polygon' : null;
        if (geometry_type === null) throw new Error(`Placemark doesn't have Point, LineString, or Polygon child.`);

        const getCoordinates = (node: Element, geometry_type: 'Point' | 'LineString' | 'Polygon'): [number, number, number] | [number, number, number][] => {
            const coordinates_node = this.get1(node, 'coordinates')!;
            const text_content = coordinates_node.textContent!;

            if (geometry_type === 'Point') {
                const split = text_content.split(',');
                const longitude = parseFloat(split[0]);
                const latitude = parseFloat(split[1]);
                const altitude = split.length > 2 ? parseFloat(split[2]) : 0;

                return [longitude, latitude, altitude];
            }
            else if (geometry_type === 'LineString' || geometry_type === 'Polygon') {
                const splits = text_content.trim().split(' ');

                return splits.map(coordinate => {
                    const split = coordinate.trim().split(',');
                    const longitude = parseFloat(split[0]);
                    const latitude = parseFloat(split[1]);
                    const altitude = split.length > 2 ? parseFloat(split[2]) : 0;

                    return [longitude, latitude, altitude];
                }) as [number, number, number][];
            }

            return [0, 0, 0]
        }

        const coordinates = getCoordinates((geometry_type === 'Point' ? point_node : geometry_type === 'LineString' ? linestring_node : polygon_node) as Element, geometry_type);

        const properties: any = {
            name: name_node?.textContent ?? '',
            description: description_node?.textContent ?? '',
            folder_id
        };

        if (style_id) {
            const style_map = style_maps.find(_ => _.id === style_id.replace('#', ''));
            const style = styles.find(_ => _.style_id === style_id.replace('#', ''));
            if (style_map) {

                const normal_style = styles.find(_ => _.style_id === style_map.normal);
                const highlight_style = styles.find(_ => _.style_id === style_map.highlight);

                if (normal_style) {
                    Object.keys(normal_style).forEach(key => {
                        if (key === 'style_id') return;
                        const value = normal_style[key];
                        properties[key] = value;
                    })
                }
                if (highlight_style) {
                    Object.keys(highlight_style).forEach(key => {
                        if (key === 'style_id') return;
                        const value = highlight_style[key];
                        if (!(normal_style && normal_style[key] === highlight_style[key])) properties['highlight-' + key] = value;
                    })
                }

            }
            else if (style) {
                Object.keys(style).forEach(key => {
                    if (key === 'style_id') return;
                    const value = style[key];
                    properties[key] = value;
                })
            }

            Object.keys(properties).forEach(key => {
                if (geometry_type === 'Point') {
                    if (key.startsWith('line-') || key.startsWith('highlight-line-') || key.startsWith('fill-') || key.startsWith('highlight-fill-')) {
                        delete properties[key];
                    }
                }
                else if (geometry_type === 'LineString') {
                    if (key.startsWith('icon-') || key.startsWith('highlight-icon-') || key.startsWith('fill-') || key.startsWith('highlight-fill-')) {
                        delete properties[key];
                    }
                }
                else if (geometry_type === 'Polygon') {
                    if (key.startsWith('icon-') || key.startsWith('highlight-icon-') || key.startsWith('line-') || key.startsWith('highlight-line-')) {
                        delete properties[key];
                    }
                }
            })
        }

        return {
            type: 'Feature',
            id: crypto.randomUUID(),
            geometry: {
                type: geometry_type,
                coordinates
            },
            properties
        }

    }

    private readonly parseFolder = (node: Element, parent_folder_id: string): KmlFolder => {

        const name_node = this.get1(node, 'name');

        return {
            folder_id: crypto.randomUUID(),
            name: name_node?.textContent ?? 'Untitled folder',
            parent_folder_id
        }
    }

    private readonly parseNode = (
        node: Element,
        folder_id: string = 'root',
        styles: any[],
        style_maps: any[],
        folders: any[] = [],
        placemarks: any[] = [],
        level = 0
    ) => {

        const node_name = node.nodeName;

        // Parse current node
        if (node_name === 'Placemark') {
            const placemark = this.parsePlacemark(node, styles, style_maps, folder_id);
            placemarks.push(placemark);
        }
        else if (node_name === 'Folder') {
            const folder = this.parseFolder(node, folder_id);
            folders.push(folder);
            folder_id = folder.folder_id;
        }


        // Loop through children
        if (node.childNodes) {
            for (let i = 0; i < node.childNodes.length; i++) {
                const child_node = node.childNodes[i];
                this.parseNode(child_node as Element, folder_id, styles, style_maps, folders, placemarks, level + 1);

            }
        }

    }

    private readonly parseStyleNode = (node: Element) => {
        const icon_style_node = this.get1(node, 'IconStyle');
        const line_style_node = this.get1(node, 'LineStyle');
        const poly_style_node = this.get1(node, 'PolyStyle');
        const label_style_node = this.get1(node, 'LabelStyle');

        const id = node.getAttribute('id');

        const obj: any = {
            style_id: id
        };

        if (icon_style_node) {
            const color_node = this.get1(icon_style_node, 'color');
            if (color_node) {
                const { color, opacity } = this.kmlColor(color_node.textContent);
                obj['icon-color'] = color;
                obj['icon-opacity'] = opacity;
            }

            const scale_node = this.get1(icon_style_node, 'scale');
            if (scale_node) {
                const scale_content = scale_node.textContent;
                if (scale_content && !isNaN(parseFloat(scale_content))) {
                    obj['icon-size'] = parseFloat(scale_content);
                }
            }

            const icon_node = this.get1(icon_style_node, 'Icon');
            if (icon_node) {
                const href_node = this.get1(icon_node, 'href');
                if (href_node && href_node.textContent) {
                    obj['icon-image'] = href_node.textContent;
                }
            }
        }

        if (line_style_node) {
            const color_node = this.get1(line_style_node, 'color');
            if (color_node) {
                const { color, opacity } = this.kmlColor(color_node.textContent);
                obj['line-color'] = color;
                obj['line-opacity'] = opacity;
            }

            const width_node = this.get1(line_style_node, 'width');
            if (width_node) {
                const width_content = width_node.textContent;
                if (width_content && !isNaN(parseFloat(width_content))) {
                    obj['line-width'] = parseFloat(width_content);
                }
            }
        }

        if (poly_style_node) {
            const color_node = this.get1(poly_style_node, 'color');
            if (color_node) {
                const { color, opacity } = this.kmlColor(color_node.textContent);
                obj['fill-color'] = color;
                obj['fill-opacity'] = opacity;
                obj['fill-outline-color'] = color;
            }
        }

        if (label_style_node) {
            const color_node = this.get1(label_style_node, 'color');
            if (color_node) {
                const { color, opacity } = this.kmlColor(color_node.textContent);
                obj['text-color'] = color;
                obj['text-opacity'] = opacity;
            }

            const scale_node = this.get1(label_style_node, 'scale');
            if (scale_node) {
                const scale_content = scale_node.textContent;
                if (scale_content && !isNaN(parseFloat(scale_content))) {
                    obj['text-size'] = Math.round(parseFloat(scale_content) * 16);
                }
            }
        }

        return obj;
    }

    private readonly parseStyles = (node: Element) => {

        const style_nodes = node.getElementsByTagName('Style');
        const cascading_style_nodes = node.getElementsByTagName('gx:CascadingStyle');
        const style_map_nodes = node.getElementsByTagName('StyleMap');

        const styles = [];
        const style_maps = [];

        for (let i = 0; i < style_nodes.length; i++) {

            const style_node = style_nodes[i];
            if (style_node.hasAttribute('id')) {
                styles.push(this.parseStyleNode(style_node));
            }
        }

        for (let i = 0; i < cascading_style_nodes.length; i++) {
            const cascading_style_node = cascading_style_nodes[i];
            const id = cascading_style_node.getAttribute('kml:id') ?? '';

            const style_node = this.get1(cascading_style_node, 'Style');
            if (style_node) {
                style_node.setAttribute('id', id);
                styles.push(this.parseStyleNode(style_node));
            }
        }

        for (let i = 0; i < style_map_nodes.length; i++) {
            const style_map_node = style_map_nodes[i];
            const style_map_id = style_map_node.getAttribute('id');
            const obj: any = { id: style_map_id };

            const pairs = style_map_node.getElementsByTagName('Pair');

            for (let j = 0; j < pairs.length; j++) {
                const pair = pairs[j];

                const key_node = this.get1(pair, 'key');
                const style_url_node = this.get1(pair, 'styleUrl');

                if (key_node && style_url_node) {
                    const key = key_node.textContent ?? '';
                    const style_url = (style_url_node.textContent ?? '').replace('#', '');
                    obj[key] = style_url;
                }
            }

            style_maps.push(obj);
        }

        return { styles, style_maps }

    }

    public readonly parse = <T extends GeoJsonProperties = GeoJsonProperties>(kml_content: string): {
        folders: KmlFolder[],
        geojson: KmlGeojson
    } => {
        const folders: any[] = [];
        const placemarks: any[] = [];

        const dom = new DOMParser().parseFromString(kml_content);
        const kml_node = this.get1(dom as any as Element, 'kml')!;

        const { styles, style_maps } = this.parseStyles(kml_node);

        this.parseNode(kml_node, 'root', styles, style_maps, folders, placemarks);

        const geojson: KmlGeojson<T> = {
            type: 'FeatureCollection',
            features: placemarks
        }

        return { folders, geojson }
    }
}