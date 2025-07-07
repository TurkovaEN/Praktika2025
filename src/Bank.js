// Bank.js
export class Bank {
  constructor(maxCapacity) {
    this.maxCapacity = maxCapacity;
    this.clients = [];
    this.counters = [];
    this.totalServed = 0;
    this.isWindingDown = false;
    this.vipQueue = [];
    this.pensionerQueue = [];
    this.reputation = 100;
    this.lastVipArrivalTime = 0;
  }
}

export class Counter {
  constructor(id, processTime, type = 'regular') {
    this.id = id;
    this.processTime = processTime;
    this.currentClient = null;
    this.isAvailable = true;
    this.position = { x: 0, y: 0 };
    this.type = type; // 'regular', 'vip', 'pensioner'
    this.isWorking = true;
  }
}

export class Client {
  static nextId = 1;
  
  constructor() {
    this.id = Client.nextId++;
    this.position = { x: 0, y: 0 };
    this.targetPosition = null;
    this.speed = 0.5 + Math.random();
    this.isWaiting = false;
    this.patience = 20000 + Math.random() * 30000;
    this.enteredTime = Date.now();
    this.isLeaving = false;
    this.served = false;
    this.serviceType = this.getRandomService();
    this.serviceTime = this.calculateServiceTime();
    this.type = this.determineClientType();
    this.emotion = 'neutral';
    this.patienceLevel = 100;
    this.isPanicking = false;
  }

  getRandomService() {
    const services = ['deposit', 'credit', 'payment', 'consultation'];
    return services[Math.floor(Math.random() * services.length)];
  }

  calculateServiceTime() {
    switch(this.serviceType) {
      case 'credit': return 8000 + Math.random() * 5000;
      case 'deposit': return 5000 + Math.random() * 3000;
      case 'consultation': return 6000 + Math.random() * 4000;
      default: return 2000 + Math.random() * 2000; // payment
    }
  }

  determineClientType() {
    const rand = Math.random();
    if (rand < 0.3) return 'pensioner';
    return 'regular';
  }

  updateEmotion() {
    const waitTime = Date.now() - this.enteredTime;
    this.patienceLevel = Math.max(0, 100 - (waitTime / this.patience) * 100);
    
    if (this.patienceLevel < 20) this.emotion = 'angry';
    else if (this.patienceLevel < 50) this.emotion = 'annoyed';
    else this.emotion = 'neutral';
  }
static resetIdCounter() {
  // Сбрасываем только если нет активных клиентов
  if (Client.nextId > 1000) { // Произвольное большое число
    Client.nextId = 1;
  }
}
}

export class VipClient extends Client {
  constructor() {
    super();
    this.type = 'vip';
    this.patience = 30000 + Math.random() * 20000; // VIP клиенты более терпеливы
    this.serviceTime = this.calculateServiceTime() * 0.8; // VIP клиентов обслуживают быстрее
  }

  getRandomService() {
    const services = ['credit', 'consultation', 'investment']; // VIP клиенты чаще используют премиальные услуги
    return services[Math.floor(Math.random() * services.length)];
  }
static resetIdCounter() {
  // Сбрасываем только если нет активных клиентов
  if (Client.nextId > 1000) { // Произвольное большое число
    Client.nextId = 1;
  }
}
}