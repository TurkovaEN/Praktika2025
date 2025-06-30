<template>
  <div class="bank-simulation">
    <h1>Банковская симуляция</h1>
    
    <div class="controls">
      <div class="slider-group">
        <label>Окон всего: {{ counterCount }}</label>
        <input type="range" min="1" max="10" v-model.number="counterCount" :disabled="isRunning">
      </div>
      
      <div class="slider-group">
        <label>VIP окон: {{ vipCounterCount }}</label>
        <input type="range" min="0" :max="counterCount" v-model.number="vipCounterCount" :disabled="isRunning">
      </div>
      
      <div class="slider-group">
        <label>Окон для пенсионеров: {{ pensionerCounterCount }}</label>
        <input type="range" min="0" :max="counterCount-vipCounterCount" v-model.number="pensionerCounterCount" :disabled="isRunning">
      </div>
      
      <div class="slider-group">
        <label>Скорость обслуживания: {{ serviceSpeed }}%</label>
        <input type="range" min="50" max="200" v-model.number="serviceSpeed" :disabled="isRunning">
      </div>
      
      <div class="slider-group">
        <label>Интенсивность потока: {{ arrivalRate }} мс</label>
        <input type="range" min="100" max="2000" step="50" v-model.number="arrivalRate" :disabled="isRunning">
      </div>
      
      <div class="slider-group">
        <label>Вероятность ухода: {{ leaveChance }}%</label>
        <input type="range" min="0" max="50" v-model.number="leaveChance" :disabled="isRunning">
      </div>
      
      <div class="slider-group">
        <label>Доля VIP: {{ vipPercentage }}%</label>
        <input type="range" min="0" max="30" v-model.number="vipPercentage" :disabled="isRunning">
      </div>
      
      <div class="button-group">
        <button @click="startSimulation" :disabled="isRunning">Старт</button>
        <button @click="stopSimulation" :disabled="!isRunning">Стоп</button>
        <button @click="resetSimulation">Сброс</button>
        <button @click="triggerRandomEvent" :disabled="!isRunning">Случайное событие</button>
      </div>
    </div>
    
    <div class="stats">
      <div>Клиентов: {{ totalClients }}</div>
      <div>Обслужено: {{ bank.totalServed }}</div>
      <div>Свободных окон: {{ availableCounters }}</div>
      <div>Ушло клиентов: {{ leftClients }}</div>
      <div v-if="bank.isWindingDown" class="simulation-winding">Завершение работы...</div>
      <div v-if="simulationFinished" class="simulation-finished">Симуляция завершена!</div>
      <div v-if="randomEventActive" class="random-event">Событие: {{ randomEventText }}</div>
    </div>
    
    <div class="bank-visualization" ref="bankArea">
      <div class="bank-walls">
        <div class="entrance-door">🚪</div>
        <div class="atm" :style="{ left: atmPosition.x + 'px', top: atmPosition.y + 'px' }">🏧</div>
        
        <div 
          v-for="counter in bank.counters" 
          :key="counter.id"
          class="service-window"
          :class="{
            'vip-counter': counter.type === 'vip',
            'pensioner-counter': counter.type === 'pensioner',
            'counter-closed': !counter.isWorking
          }"
          :style="{
            left: counter.position.x + 'px',
            top: counter.position.y + 'px',
            backgroundColor: counter.currentClient ? '#F44336' : counter.isWorking ? '#4CAF50' : '#9E9E9E'
          }"
          @click="toggleCounter(counter)"
        >
          <span v-if="counter.currentClient">⏱️</span>
          <span v-else>{{ counter.type === 'vip' ? '⭐' : counter.type === 'pensioner' ? '👵' : '👔' }}</span>
          <div class="counter-type">{{ counter.type }}</div>
        </div>
        
        <!-- VIP очередь -->
        <div 
          v-for="(client, index) in bank.vipQueue" 
          :key="'vip-'+client.id"
          class="client vip-client"
          :style="{
            left: (vipQueuePosition.x - index * 30) + 'px',
            top: vipQueuePosition.y + 'px',
            opacity: client.patienceLevel/100
          }"
        >
          <span class="client-emoji">🎩</span>
          <div class="client-status">{{ client.serviceType }}</div>
          <div class="emotion-indicator" :class="client.emotion"></div>
        </div>
        
        <!-- Пенсионерская очередь -->
        <div 
          v-for="(client, index) in bank.pensionerQueue" 
          :key="'pensioner-'+client.id"
          class="client pensioner-client"
          :style="{
            left: (pensionerQueuePosition.x - index * 30) + 'px',
            top: pensionerQueuePosition.y + 'px',
            opacity: client.patienceLevel/100
          }"
        >
          <span class="client-emoji">👵</span>
          <div class="client-status">{{ client.serviceType }}</div>
          <div class="emotion-indicator" :class="client.emotion"></div>
        </div>
        
        <!-- Основная очередь -->
        <div 
          v-for="(client) in queuePositions" 
          :key="client.id"
          class="client"
          :class="{
            'serving-client': client.isServing,
            [client.emotion]: true
          }"
          :style="{
            left: client.position.x + 'px',
            top: client.position.y + 'px',
            opacity: client.isServing ? 0.7 : client.patienceLevel/100
          }"
        >
          <span class="client-emoji">{{ client.type === 'vip' ? '🎩' : '🧍' }}</span>
          <div class="client-status">{{ client.serviceType }}</div>
          <div class="emotion-indicator" :class="client.emotion"></div>
        </div>
        
        <!-- Клиенты у терминала -->
        <div 
          v-for="client in atmClients" 
          :key="'atm-'+client.id"
          class="client atm-client"
          :style="{
            left: client.position.x + 'px',
            top: client.position.y + 'px'
          }"
        >
          <span class="client-emoji">💳</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Bank, Counter, Client } from './Bank';

export default {
  data() {
    return {
      bank: new Bank(50),
      counterCount: 5,
      vipCounterCount: 1,
      pensionerCounterCount: 1,
      serviceSpeed: 100,
      arrivalRate: 500,
      leaveChance: 10,
      vipPercentage: 10,
      isRunning: false,
      simulationFinished: false,
      intervals: [],
      totalEntered: 0,
      leftClients: 0,
      queuePositions: [],
      atmClients: [],
      atmPosition: { x: 150, y: 100 },
      vipQueuePosition: { x: 400, y: 80 },
      pensionerQueuePosition: { x: 400, y: 400 },
      isDrainingQueues: false,
      randomEventActive: false,
      randomEventText: '',
      atmBroken: false
    };
  },
  computed: {
    availableCounters() {
      return this.bank.counters.filter(c => c.isAvailable && c.isWorking).length;
    },
    regularCounterCount() {
      return this.counterCount - this.vipCounterCount - this.pensionerCounterCount;
    },
    totalClients() {
      return this.bank.clients.length + 
             this.bank.vipQueue.length + 
             this.bank.pensionerQueue.length + 
             this.queuePositions.length +
             this.atmClients.length;
    }
  },
  watch: {
    counterCount(newVal) {
      this.vipCounterCount = Math.min(this.vipCounterCount, newVal);
      this.pensionerCounterCount = Math.min(this.pensionerCounterCount, newVal - this.vipCounterCount);
      this.initializeCounters();
    },
    vipCounterCount() {
      this.initializeCounters();
    },
    pensionerCounterCount() {
      this.initializeCounters();
    }
  },
  mounted() {
    this.initializeCounters();
    this.setupBankDimensions();
    window.addEventListener('resize', this.setupBankDimensions);
  },
  beforeUnmount() {
    this.stopSimulation();
    window.removeEventListener('resize', this.setupBankDimensions);
  },
  methods: {
    initializeCounters() {
      this.bank.counters = [];
      let id = 1;
      
      // VIP окна
      for (let i = 0; i < this.vipCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 3000 * (100/this.serviceSpeed), 'vip'));
      }
      
      // Окна для пенсионеров
      for (let i = 0; i < this.pensionerCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 4000 * (100/this.serviceSpeed), 'pensioner'));
      }
      
      // Обычные окна
      for (let i = 0; i < this.regularCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 5000 * (100/this.serviceSpeed), 'regular'));
      }
      
      this.positionCounters();
    },
    
    positionCounters() {
      if (!this.$refs.bankArea) {
        setTimeout(this.positionCounters, 100);
        return;
      }
      
      const bankRect = this.$refs.bankArea.getBoundingClientRect();
      const offset = 70;
      const spacing = (bankRect.height - 2 * offset) / Math.max(1, this.counterCount);
      
      this.bank.counters.forEach((counter, i) => {
        counter.position = {
          x: bankRect.width - offset,
          y: offset + i * spacing
        };
      });
      
      // Позиционирование элементов
      this.vipQueuePosition = { 
        x: bankRect.width * 0.7, 
        y: bankRect.height * 0.2 
      };
      
      this.pensionerQueuePosition = { 
        x: bankRect.width * 0.7, 
        y: bankRect.height * 0.8 
      };
      
      this.atmPosition = { 
        x: bankRect.width * 0.2, 
        y: bankRect.height * 0.8 
      };
    },
    
    setupBankDimensions() {
      this.$nextTick(() => {
        this.positionCounters();
      });
    },
    
    startSimulation() {
      this.resetSimulation();
      this.isRunning = true;
      this.simulationFinished = false;
      this.bank.isWindingDown = false;
      this.atmBroken = false;
      
      // Добавление новых клиентов
      this.intervals.push(setInterval(() => {
        if (this.bank.isWindingDown) return;
        
        const client = new Client();
        
        // Принудительно делаем VIP по настройке
        if (Math.random() < this.vipPercentage/100) {
          client.type = 'vip';
        }
        
        // Распределение клиентов
        if (client.type === 'vip') {
          this.bank.vipQueue.push(client);
          client.position = { x: 50, y: 100 };
          client.targetPosition = { ...this.vipQueuePosition };
        } 
        else if (client.type === 'pensioner') {
          this.bank.pensionerQueue.push(client);
          client.position = { x: 50, y: 150 };
          client.targetPosition = { ...this.pensionerQueuePosition };
        } 
        else {
          if (!this.atmBroken && Math.random() < 0.3 && 
              (client.serviceType === 'payment' || client.serviceType === 'deposit')) {
            this.processAtmClient(client);
          } else {
            this.addToRegularQueue(client);
          }
        }
        
        this.totalEntered++;
      }, this.arrivalRate));
      
      // Основной цикл
      this.intervals.push(setInterval(() => {
        this.updateClientsEmotions();
        this.checkLeavingClients();
        this.serveQueues();
        this.moveClients();
      }, 50));
    },
    
    updateClientsEmotions() {
      [...this.bank.vipQueue, ...this.bank.pensionerQueue, ...this.queuePositions].forEach(client => {
        client.updateEmotion();
      });
    },
    
    checkLeavingClients() {
      // VIP очередь
      this.bank.vipQueue = this.bank.vipQueue.filter(client => {
        if (Math.random() < this.leaveChance/10000 * client.patienceLevel) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });
      
      // Пенсионерская очередь
      this.bank.pensionerQueue = this.bank.pensionerQueue.filter(client => {
        if (Math.random() < this.leaveChance/8000 * client.patienceLevel) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });
      
      // Основная очередь
      this.queuePositions = this.queuePositions.filter(client => {
        if (Math.random() < this.leaveChance/5000 * client.patienceLevel) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });
    },
    
    serveQueues() {
      // VIP очередь
      const availableVipCounter = this.bank.counters.find(c => 
        c.type === 'vip' && c.isAvailable && c.isWorking
      );
      if (availableVipCounter && this.bank.vipQueue.length > 0) {
        const client = this.bank.vipQueue.shift();
        this.serveClient(client, availableVipCounter);
      }
      
      // Пенсионерская очередь
      const availablePensionerCounter = this.bank.counters.find(c => 
        c.type === 'pensioner' && c.isAvailable && c.isWorking
      );
      if (availablePensionerCounter && this.bank.pensionerQueue.length > 0) {
        const client = this.bank.pensionerQueue.shift();
        this.serveClient(client, availablePensionerCounter);
      }
      
      // Основная очередь
      this.bank.counters
        .filter(c => c.type === 'regular' && c.isAvailable && c.isWorking)
        .forEach(counter => {
          if (this.queuePositions.length > 0) {
            const client = this.queuePositions.shift();
            this.serveClient(client, counter);
          }
        });
    },
    
    async serveClient(client, counter) {
      counter.isAvailable = false;
      counter.currentClient = client;
      client.isServing = true;
      
      // Анимация подхода
      client.targetPosition = {
        x: counter.position.x - 20,
        y: counter.position.y
      };
      
      await this.waitForClientToReach(client);
      
      // Обслуживание
      await new Promise(resolve => 
        setTimeout(resolve, client.serviceTime * (100/this.serviceSpeed))
      );
      
      // Уход клиента
      await this.makeClientLeave(client);
      counter.isAvailable = true;
      counter.currentClient = null;
      this.bank.totalServed++;
    },
    
    processAtmClient(client) {
      client.position = { x: 50, y: this.$refs.bankArea.clientHeight - 50 };
      client.targetPosition = { ...this.atmPosition };
      this.atmClients.push(client);
      
      setTimeout(() => {
        this.atmClients = this.atmClients.filter(c => c.id !== client.id);
        this.bank.totalServed++;
      }, 3000 * (100/this.serviceSpeed));
    },
    
    addToRegularQueue(client) {
      client.position = { x: 50, y: 200 };
      client.targetPosition = {
        x: this.$refs.bankArea.clientWidth - 200,
        y: this.$refs.bankArea.clientHeight / 2
      };
      this.queuePositions.push(client);
    },
    
    async makeClientLeave(client) {
      client.isLeaving = true;
      client.targetPosition = { x: 30, y: client.position.y };
      await this.waitForClientToReach(client);
      this.removeClient(client);
    },
    
    removeClient(client) {
      this.bank.clients = this.bank.clients.filter(c => c.id !== client.id);
      this.queuePositions = this.queuePositions.filter(c => c.id !== client.id);
      this.bank.vipQueue = this.bank.vipQueue.filter(c => c.id !== client.id);
      this.bank.pensionerQueue = this.bank.pensionerQueue.filter(c => c.id !== client.id);
      this.atmClients = this.atmClients.filter(c => c.id !== client.id);
    },
    
    async waitForClientToReach(client) {
      while (Math.abs(client.position.x - client.targetPosition.x) > 5 || 
             Math.abs(client.position.y - client.targetPosition.y) > 5) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    
    moveClients() {
      // Движение VIP клиентов
      this.bank.vipQueue.forEach((client, index) => {
        client.targetPosition = {
          x: this.vipQueuePosition.x - index * 30,
          y: this.vipQueuePosition.y
        };
        this.moveClient(client);
      });
      
      // Движение пенсионеров
      this.bank.pensionerQueue.forEach((client, index) => {
        client.targetPosition = {
          x: this.pensionerQueuePosition.x - index * 30,
          y: this.pensionerQueuePosition.y
        };
        this.moveClient(client);
      });
      
      // Движение в основной очереди
      this.queuePositions.forEach((client, index) => {
        client.targetPosition = {
          x: this.$refs.bankArea.clientWidth - 200 - index * 30,
          y: this.$refs.bankArea.clientHeight / 2
        };
        this.moveClient(client);
      });
      
      // Движение к терминалу
      this.atmClients.forEach(client => {
        this.moveClient(client);
      });
    },
    
    moveClient(client) {
      const dx = client.targetPosition.x - client.position.x;
      const dy = client.targetPosition.y - client.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 2) {
        client.position.x += dx * 0.1;
        client.position.y += dy * 0.1;
      }
    },
    
    toggleCounter(counter) {
      if (this.isRunning) {
        counter.isWorking = !counter.isWorking;
        if (!counter.isWorking && counter.currentClient) {
          this.makeClientLeave(counter.currentClient);
          counter.currentClient = null;
          counter.isAvailable = true;
        }
      }
    },
    
    triggerRandomEvent() {
      const events = [
        { text: "Терминал сломался!", action: () => { this.atmBroken = true; } },
        { text: "Терминал починился!", action: () => { this.atmBroken = false; } },
        { text: "Наплыв клиентов!", action: () => { this.arrivalRate = Math.max(100, this.arrivalRate - 200); } },
        { text: "Сотрудник заболел", action: () => { 
          const workingCounters = this.bank.counters.filter(c => c.isWorking);
          if (workingCounters.length > 1) {
            workingCounters[0].isWorking = false;
          }
        }}
      ];
      
      const event = events[Math.floor(Math.random() * events.length)];
      this.randomEventText = event.text;
      this.randomEventActive = true;
      event.action();
      
      setTimeout(() => {
        this.randomEventActive = false;
      }, 3000);
    },
    
    stopSimulation() {
      this.intervals.forEach(clearInterval);
      this.intervals = [];
      this.isRunning = false;
    },
    
    resetSimulation() {
      this.stopSimulation();
      this.bank = new Bank(50);
      this.bank.totalServed = 0;
      this.totalEntered = 0;
      this.leftClients = 0;
      this.simulationFinished = false;
      this.bank.isWindingDown = false;
      this.queuePositions = [];
      this.atmClients = [];
      this.randomEventActive = false;
      this.initializeCounters();
    }
  }
};
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.bank-simulation {
  font-family: Arial, sans-serif;
  max-width: 1200px;
  margin: 20px auto;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 40px);
}

.controls {
  margin: 20px 0;
  padding: 20px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0,0,0,0.05);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
}

.slider-group {
  margin-bottom: 0;
}

.slider-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

.slider-group input {
  width: 100%;
}

.button-group {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 10px;
}

button {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

button:hover {
  background: #45a049;
}

button:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin: 10px 0;
  padding: 15px;
  background: #e8f5e9;
  border-radius: 8px;
  font-size: 14px;
}

.simulation-winding {
  color: #FF9800;
  font-weight: bold;
}

.simulation-finished {
  color: #4CAF50;
  font-weight: bold;
}

.random-event {
  color: #2196F3;
  font-weight: bold;
  animation: blink 1s infinite;
}

@keyframes blink {
  50% { opacity: 0.5; }
}

.bank-visualization {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 500px;
  background-color: #f5f5f5;
  border: 4px solid #333;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 15px rgba(0,0,0,0.2);
}

.bank-walls {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #f9f9f9;
}

.entrance-door {
  position: absolute;
  width: 40px;
  height: 80px;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.service-window {
  position: absolute;
  width: 60px;
  height: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  z-index: 2;
  transition: all 0.3s ease;
  cursor: pointer;
  border-radius: 5px;
}

.vip-counter {
  border: 2px solid gold;
}

.pensioner-counter {
  border: 2px solid #FF9800;
}

.counter-closed {
  background-color: #9E9E9E !important;
}

.counter-type {
  font-size: 10px;
  margin-top: 5px;
  text-transform: capitalize;
}

.client {
  position: absolute;
  width: 30px;
  height: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.5s ease;
  transform: translate(-50%, -50%);
}

.vip-client {
  z-index: 3;
}

.pensioner-client {
  z-index: 3;
}

.client-emoji {
  font-size: 24px;
}

.client-status {
  font-size: 10px;
  margin-top: 2px;
  white-space: nowrap;
  text-transform: capitalize;
}

.emotion-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 2px;
}

.emotion-indicator.neutral {
  background-color: #4CAF50;
}

.emotion-indicator.annoyed {
  background-color: #FFC107;
}

.emotion-indicator.angry {
  background-color: #F44336;
}

.atm {
  position: absolute;
  font-size: 40px;
  z-index: 1;
  transform: translate(-50%, -50%);
}

.atm-client {
  z-index: 2;
}

.serving-client {
  opacity: 0.7;
  transform: translate(-50%, -50%) scale(1.1);
  z-index: 4;
}

.neutral {
  filter: none;
}

.annoyed {
  filter: sepia(0.5) saturate(2);
}

.angry {
  filter: sepia(0.8) saturate(4) hue-rotate(-10deg);
}

@media (max-width: 768px) {
  .bank-simulation {
    margin: 10px;
    padding: 10px;
    height: auto;
  }
  
  .controls {
    grid-template-columns: 1fr;
  }
  
  .bank-visualization {
    min-height: 400px;
  }
}
</style>