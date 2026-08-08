// Sprite-filen ligger i public/ och serveras därför under appens bas-URL,
// inte under domänroten. En hårdkodad "/icons.svg" ger 404 eftersom appen
// körs på /beefcake/. BASE_URL slutar alltid med snedstreck.
export function icon(id: string): string {
  return `${import.meta.env.BASE_URL}icons.svg#${id}`
}
