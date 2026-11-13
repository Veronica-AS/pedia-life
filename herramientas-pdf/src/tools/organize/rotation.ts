/** Normaliza a 0, 90, 180 o 270 grados */
export const normRotation = (deg: number) => (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
