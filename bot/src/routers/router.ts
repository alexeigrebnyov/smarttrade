import { Opportunity } from '../utils/types';
export class Router {
  selectBest(opps: Opportunity[]): Opportunity[] {
    return [...opps].sort((a, b) => b.estProfit - a.estProfit).slice(0, 3);
  }
}
