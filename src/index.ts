import * as fs from 'fs';
import { DOMParser } from 'xmldom';


const get1 = (node: Node, tag_name: string): Node | null => {
    const nodes = (node as Document).getElementsByTagName(tag_name);
    return nodes.length ? nodes[0] : null;
}

const parsePlacemark = (node: Node) => {
    const name_node = get1(node, 'name');
    const description_node = get1(node, 'description');
    const point_node = get1(node, 'Point');
    const linestring_node = get1(node, 'LineString');
    const polygon_node = get1(node, 'Polygon');
    const style_url_node = get1(node, 'styleUrl');

    const geometry_type = point_node ? 'Point' : linestring_node ? 'LineString' : polygon_node ? 'Polygon' : null;
    if (geometry_type === null) throw new Error(`Placemark doesn't have Point, LineString, or Polygon child.`);

    const getCoordinates = (node: Node): [number, number, number] => {
        const coordinates_node = get1(node, 'coordinates')!;
        const text_content = coordinates_node.textContent!;
        const split = text_content.split(',');
        const longitude = parseFloat(split[0]);
        const latitude = parseFloat(split[1]);
        const altitude = split.length > 2 ? parseFloat(split[2]) : 0;

        return [longitude, latitude, altitude];
    }

    const coordinates = getCoordinates((geometry_type === 'Point' ? point_node : geometry_type === 'LineString' ? linestring_node : polygon_node) as Node);

    return {
        type: 'Feature',
        geometry: {
            type: geometry_type,
            coordinates
        },
        properties: {
            name: name_node?.textContent ?? '',
            description: description_node?.textContent ?? ''
        }
    }

}

const parseNode = (
    node: Node,
    folder_id: string = 'root',
    folders: any[] = [],
    placemarks: any[] = []
) => {

    for (let i = 0; i < node.childNodes.length; i++) {

        const child_node = node.childNodes[i];
        const node_name = child_node.nodeName;

        if (node_name === 'Document') {

        }
        else if (node_name === 'Placemark') {
            const placemark = parsePlacemark(child_node);
        }
        else if (node_name === 'Folder') {

        }
        else if (node_name === 'Style') {

        }

    }

}

const kml = new DOMParser().parseFromString(fs.readFileSync('./test4.kml', 'utf-8'));

const kml_node = get1(kml, 'kml')!;

const folders: any[] = [];
const placemarks: any[] = [];

parseNode(kml_node);

console.log(folders);
console.log(placemarks);

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