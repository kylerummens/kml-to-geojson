import * as fs from 'fs';
import { DOMParser } from 'xmldom';
const crypto = require('crypto');


const get1 = (node: Element, tag_name: string): Element | null => {
    const nodes = node.getElementsByTagName(tag_name);
    return nodes.length ? nodes[0] : null;
}

const kmlColor = (v: any) => {
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

const parsePlacemark = (node: Element, styles: any[], style_maps: any[], folder_id: string) => {
    const name_node = get1(node, 'name');
    const description_node = get1(node, 'description');
    const point_node = get1(node, 'Point');
    const linestring_node = get1(node, 'LineString');
    const polygon_node = get1(node, 'Polygon');
    const style_url_node = get1(node, 'styleUrl');
    const style_id = style_url_node?.textContent;

    const geometry_type = point_node ? 'Point' : linestring_node ? 'LineString' : polygon_node ? 'Polygon' : null;
    if (geometry_type === null) throw new Error(`Placemark doesn't have Point, LineString, or Polygon child.`);

    const getCoordinates = (node: Element): [number, number, number] => {
        const coordinates_node = get1(node, 'coordinates')!;
        const text_content = coordinates_node.textContent!;
        const split = text_content.split(',');
        const longitude = parseFloat(split[0]);
        const latitude = parseFloat(split[1]);
        const altitude = split.length > 2 ? parseFloat(split[2]) : 0;

        return [longitude, latitude, altitude];
    }

    const coordinates = getCoordinates((geometry_type === 'Point' ? point_node : geometry_type === 'LineString' ? linestring_node : polygon_node) as Element);

    const properties: any = {
        name: name_node?.textContent ?? '',
        description: description_node?.textContent ?? '',
        folder_id
    };

    if (style_id) {
        const style_map = style_maps.find(_ => _.id === style_id.replace('#', ''));
        if (style_map) {
            console.log(style_map);

            const normal_style = styles.find(_ => _.style_id === style_map.normal);
            const highlight_style = styles.find(_ => _.style_id === style_map.highlight);

        }
    }

    return {
        type: 'Feature',
        geometry: {
            type: geometry_type,
            coordinates
        },
        properties
    }

}

const parseFolder = (node: Element, parent_folder_id: string) => {

    const name_node = get1(node, 'name');
    console.log('Folder: ' + name_node?.textContent);

    return {
        folder_id: crypto.randomUUID(),
        name: name_node?.textContent ?? 'Untitled folder',
        parent_folder_id
    }
}

const parseNode = (
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
        console.log(level, node_name);
        const placemark = parsePlacemark(node, styles, style_maps, folder_id);
        placemarks.push(placemark);
    }
    else if (node_name === 'Folder') {
        const folder = parseFolder(node, folder_id);
        folders.push(folder);
        folder_id = folder.folder_id;
    }
    else if (node_name === 'Style') {
        console.log(level, node_name);
    }


    // Loop through children
    if (node.childNodes) {
        for (let i = 0; i < node.childNodes.length; i++) {
            const child_node = node.childNodes[i];
            parseNode(child_node as Element, folder_id, styles, style_maps, folders, placemarks, level + 1);

        }
    }

}

const parseStyleNode = (node: Element) => {
    const icon_style_node = get1(node, 'IconStyle');
    const line_style_node = get1(node, 'LineStyle');
    const poly_style_node = get1(node, 'PolyStyle');
    const label_style_node = get1(node, 'LabelStyle');

    const id = node.getAttribute('id');

    const obj: any = {
        style_id: id
    };

    if (icon_style_node) {
        const color_node = get1(icon_style_node, 'color');
        if (color_node) {
            const { color, opacity } = kmlColor(color_node.textContent);
            obj['icon-color'] = color;
            obj['icon-opacity'] = opacity;
        }

        const scale_node = get1(icon_style_node, 'scale');
        if (scale_node) {
            const scale_content = scale_node.textContent;
            if (scale_content && !isNaN(parseFloat(scale_content))) {
                obj['icon-size'] = parseFloat(scale_content);
            }
        }

        const icon_node = get1(icon_style_node, 'Icon');
        if (icon_node) {
            const href_node = get1(icon_node, 'href');
            if (href_node && href_node.textContent) {
                obj['icon-image'] = href_node.textContent;
            }
        }
    }

    if (line_style_node) {
        const color_node = get1(line_style_node, 'color');
        if (color_node) {
            const { color, opacity } = kmlColor(color_node.textContent);
            obj['line-color'] = color;
            obj['line-opacity'] = opacity;
        }

        const width_node = get1(line_style_node, 'width');
        if (width_node) {
            const width_content = width_node.textContent;
            if (width_content && !isNaN(parseFloat(width_content))) {
                obj['line-width'] = parseFloat(width_content);
            }
        }
    }

    if (poly_style_node) {
        const color_node = get1(poly_style_node, 'color');
        if (color_node) {
            const { color, opacity } = kmlColor(color_node.textContent);
            obj['fill-color'] = color;
            obj['fill-opacity'] = opacity;
            obj['fill-outline-color'] = color;
        }
    }

    if (label_style_node) {
        const color_node = get1(label_style_node, 'color');
        if (color_node) {
            const { color, opacity } = kmlColor(color_node.textContent);
            obj['text-color'] = color;
            obj['text-opacity'] = opacity;
        }

        const scale_node = get1(label_style_node, 'scale');
        if (scale_node) {
            const scale_content = scale_node.textContent;
            if (scale_content && !isNaN(parseFloat(scale_content))) {
                obj['text-size'] = Math.round(parseFloat(scale_content) * 16);
            }
        }
    }

    return obj;
}

const parseStyles = (node: Element) => {

    const style_nodes = node.getElementsByTagName('Style');
    const cascading_style_nodes = node.getElementsByTagName('gx:CascadingStyle');
    const style_map_nodes = node.getElementsByTagName('StyleMap');

    const styles = [];
    const style_maps = [];

    for (let i = 0; i < style_nodes.length; i++) {

        const style_node = style_nodes[i];
        if (style_node.hasAttribute('id')) {
            styles.push(parseStyleNode(style_node));
        }
    }

    for (let i = 0; i < cascading_style_nodes.length; i++) {
        const cascading_style_node = cascading_style_nodes[i];
        const id = cascading_style_node.getAttribute('kml:id') ?? '';

        const style_node = get1(cascading_style_node, 'Style');
        if (style_node) {
            style_node.setAttribute('id', id);
            styles.push(parseStyleNode(style_node));
        }
    }

    for (let i = 0; i < style_map_nodes.length; i++) {
        const style_map_node = style_map_nodes[i];
        const style_map_id = style_map_node.getAttribute('id');
        const obj: any = { id: style_map_id };

        const pairs = style_map_node.getElementsByTagName('Pair');

        for (let j = 0; j < pairs.length; j++) {
            const pair = pairs[j];

            const key_node = get1(pair, 'key');
            const style_url_node = get1(pair, 'styleUrl');

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

const parseKml = (kml_content: string) => {
    const folders: any[] = [];
    const placemarks: any[] = [];

    const dom = new DOMParser().parseFromString(kml_content);

    const kml_node = get1(dom as any as Element, 'kml')!;

    const { styles, style_maps } = parseStyles(kml_node);

    //console.log(styles);
    //console.log(style_maps);

    parseNode(kml_node, 'root', styles, style_maps, folders, placemarks);

    return { folders, placemarks }
}

const kml = fs.readFileSync('./test-kmls/test4.kml', 'utf-8');


const { folders, placemarks } = parseKml(kml);


//console.log(folders);
//console.log(placemarks);

/*
const folders = kml.getElementsByTagName('Folder');

for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];

    const name_nodes = folder.getElementsByTagName('name');
    const folder_name = name_nodes.length ? name_nodes[0].textContent : 'Untitled Folder';

    console.log(folder_name);


    const placemarks = folder.getElementsByTagName('Placemark');
    for (let j = 0; j < placemarks.length; j++) {
        const placemark = placemarks[j];
        if (placemark.parentNode !== folder) {
            console.log('Grandchild found: ', placemark.getElementsByTagName('name')[0].innerHTML);
        }
    }
}
*/