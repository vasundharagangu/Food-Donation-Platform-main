import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconRetinaUrl: icon2x,
  iconUrl: icon,
  shadowUrl: shadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const colors = {
  green: 'green',
  yellow: 'gold',
  red: 'red',
  blue: 'blue'
};

function makeColoredIcon(color) {
  return new L.DivIcon({
    html: `<i class="bi bi-geo-alt-fill" style="color:${color};font-size:28px;text-shadow:0 0 2px #000"></i>`,
    iconSize: [28, 28],
    className: ''
  });
}

export default function MapView({ center = [20.5937, 78.9629], zoom = 12, height = 400, markers = [] }) {
  return (
    <div style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, idx) => (
          <Marker key={idx} position={[m.lat, m.lng]} icon={makeColoredIcon(colors[m.color] || colors.blue)}>
            <Popup>
              {m.popup || 'Marker'}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
