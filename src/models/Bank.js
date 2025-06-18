// src/models/Bank.js
export class Bank {
  constructor(maxCapacity) {
    this.maxCapacity = maxCapacity;
    this.clients = [];
    this.counters = [];
  }

  addClient(client) {
    if (this.clients.length < this.maxCapacity) {
      this.clients.push(client);
      return true;
    }
    return false;
  }

  removeClient(clientId) {
    this.clients = this.clients.filter(c => c.id !== clientId);
  }
}

export class Counter {
  constructor(id, processTime) {
    this.id = id;
    this.processTime = processTime;
    this.currentClient = null;
    this.isAvailable = true;
    this.position = { x: 0, y: 0 };
  }

  serveClient(client) {
    this.currentClient = client;
    this.isAvailable = false;
    
    return new Promise(resolve => {
      setTimeout(() => {
        this.isAvailable = true;
        this.currentClient = null;
        resolve();
      }, this.processTime);
    });
  }
}

export class Client {
  static nextId = 1;
  
  constructor() {
    this.id = Client.nextId++;
    this.position = { x: 0, y: 0 };
    this.targetPosition = null;
    this.speed = 1 + Math.random() * 2;
  }

  move() {
    if (this.targetPosition) {
      const dx = this.targetPosition.x - this.position.x;
      const dy = this.targetPosition.y - this.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 2) {
        this.position.x += (dx / distance) * this.speed;
        this.position.y += (dy / distance) * this.speed;
      }
    }
  }
}