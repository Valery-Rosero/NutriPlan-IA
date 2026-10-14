export type Greeting = 'morning' | 'afternoon' | 'evening';

/** Saludo según la hora local: hasta las 12 «buenos días», hasta las 19 «buenas tardes», luego «buenas noches». */
export function greetingFor(hour: number): Greeting {
  return hour < 12 ? 'morning' : hour < 19 ? 'afternoon' : 'evening';
}
