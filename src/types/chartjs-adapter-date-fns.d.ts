// Type declaration for dynamically imported chartjs-adapter-date-fns
declare module 'chartjs-adapter-date-fns' {
  import { Chart } from 'chart.js'
  export default function (Chart: typeof import('chart.js')): void
}
