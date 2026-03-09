export interface DefectItem {
  id: string;
  name: string;
  category: string;
  description: string;
  area?: string; // e.g. 客廳、主臥室
  photos: string[]; // base64 or URLs
  status: 'pending' | 'fixed';
}

export interface Pin {
  id: string;
  x: number; // relative to image width (0-1)
  y: number; // relative to image height (0-1)
  defects: DefectItem[];
  createdAt: number;
}

export interface InspectionProject {
  id: string;
  name: string;
  floorPlanUrl: string | null;
  pins: Pin[];
}
