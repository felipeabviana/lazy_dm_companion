export interface MapState {
  /** Data URL of the selected image, or null when no image is loaded */
  imageUrl: string | null;
  /** Zoom factor applied to the image (1 = 100%) */
  zoom: number;
}
