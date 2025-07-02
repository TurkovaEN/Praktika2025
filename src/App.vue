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
      <div class="bank-layout">
        <div class="bank-area">
          <div class="entrance-door">🚪</div>
          <div class="atm" :style="atmStyle">🏧</div>
          
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
          
          <transition-group name="client" tag="div">
            <div
              v-for="client in enteringClients"
              :key="'entering-'+client.id"
              class="client entering-client"
              :style="{
                left: client.position.x + 'px',
                top: client.position.y + 'px',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                transition: `all ${client.speed * 0.5}s ease-out`
              }"
            >
              <span class="client-emoji">{{ getClientEmoji(client) }}</span>
            </div>
            
            <div 
              v-for="client in atmClients" 
              :key="'atm-'+client.id"
              class="client atm-client"
              :style="{
                left: client.position.x + 'px',
                top: client.position.y + 'px',
                transform: 'translate(-50%, -50%)',
                transition: `all ${client.speed * 0.5}s ease-out`
              }"
            >
              <span class="client-emoji">💳</span>
            </div>
            
            <div 
              v-for="client in servingClients" 
              :key="'serving-'+client.id"
              class="client serving-client"
              :style="{
                left: client.position.x + 'px',
                top: client.position.y + 'px',
                transform: 'translate(-50%, -50%)',
                zIndex: 5,
                transition: `all ${client.speed * 0.5}s ease-out`
              }"
            >
              <span class="client-emoji">{{ getClientEmoji(client) }}</span>
            </div>
          </transition-group>
        </div>
        
        <div class="queue-area">
          <div 
            v-for="(client, index) in bank.vipQueue" 
            :key="'vip-'+client.id"
            class="client vip-client"
            :style="{
              left: (vipQueuePosition.x - index * 30) + 'px',
              top: vipQueuePosition.y + 'px',
              opacity: client.patienceLevel/100,
              transform: 'translate(-50%, -50%)',
              transition: `all ${client.speed * 0.5}s ease-out`
            }"
          >
            <span class="client-emoji">🎩</span>
            <div class="client-status">{{ client.serviceType }}</div>
            <div class="emotion-indicator" :class="client.emotion"></div>
          </div>
          
          <div 
            v-for="(client, index) in bank.pensionerQueue" 
            :key="'pensioner-'+client.id"
            class="client pensioner-client"
            :style="{
              left: (pensionerQueuePosition.x - index * 30) + 'px',
              top: pensionerQueuePosition.y + 'px',
              opacity: client.patienceLevel/100,
              transform: 'translate(-50%, -50%)',
              transition: `all ${client.speed * 0.5}s ease-out`
            }"
          >
            <span class="client-emoji">👵</span>
            <div class="client-status">{{ client.serviceType }}</div>
            <div class="emotion-indicator" :class="client.emotion"></div>
          </div>
          
          <div 
            v-for="(client, index) in queuePositions" 
            :key="client.id"
            class="client"
            :class="{
              [client.emotion]: true
            }"
            :style="{
              left: (mainQueuePosition.x - index * 30) + 'px',
              top: mainQueuePosition.y + 'px',
              opacity: client.patienceLevel/100,
              transform: 'translate(-50%, -50%)',
              transition: `all ${client.speed * 0.5}s ease-out`
            }"
          >
            <span class="client-emoji">{{ client.type === 'vip' ? '🎩' : '🧍' }}</span>
            <div class="client-status">{{ client.serviceType }}</div>
            <div class="emotion-indicator" :class="client.emotion"></div>
          </div>
          
          <div
            v-for="client in leavingClients"
            :key="'leaving-'+client.id"
            class="client leaving-client"
            :style="{
              left: client.position.x + 'px',
              top: client.position.y + 'px',
              transform: 'translate(-50%, -50%)',
              opacity: client.leaveProgress,
              zIndex: 5,
              transition: `all ${client.speed * 0.5}s ease-out`
            }"
          >
            <span class="client-emoji">{{ getClientEmoji(client) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Bank, Counter, Client } from './Bank';
import './BankSimulation.css';

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
      animationFrame: null,
      lastUpdateTime: 0,
      totalEntered: 0,
      leftClients: 0,
      queuePositions: [],
      atmClients: [],
      enteringClients: [],
      leavingClients: [],
      servingClients: [],
      atmBroken: false,
      randomEventActive: false,
      randomEventText: '',
      vipQueuePosition: { x: 0, y: 0 },
      pensionerQueuePosition: { x: 0, y: 0 },
      mainQueuePosition: { x: 0, y: 0 },
      atmPosition: { x: 0, y: 0 },
      entrancePosition: { x: 0, y: 0 },
      exitPosition: { x: 0, y: 0 }
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
             this.atmClients.length +
             this.enteringClients.length +
             this.leavingClients.length +
             this.servingClients.length;
    },
    atmStyle() {
      return {
        left: this.atmPosition.x + 'px',
        top: this.atmPosition.y + 'px',
        transform: 'translate(-50%, -50%)'
      };
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
    getClientEmoji(client) {
      if (client.type === 'vip') return '🎩';
      if (client.type === 'pensioner') return '👵';
      return '🧍';
    },
    
    hasSpecialCounters(type) {
      return this.bank.counters.some(c => c.type === type && c.isWorking);
    },

    initializeCounters() {
      this.bank.counters = [];
      let id = 1;
      
      for (let i = 0; i < this.vipCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 3000 * (100/this.serviceSpeed), 'vip'));
      }
      
      for (let i = 0; i < this.pensionerCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 4000 * (100/this.serviceSpeed), 'pensioner'));
      }
      
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
      
      this.vipQueuePosition = { 
        x: bankRect.width * 0.6, 
        y: bankRect.height * 0.2 
      };
      
      this.pensionerQueuePosition = { 
        x: bankRect.width * 0.6, 
        y: bankRect.height * 0.8 
      };
      
      this.mainQueuePosition = {
        x: bankRect.width * 0.6,
        y: bankRect.height / 2
      };
      
      this.atmPosition = { 
        x: bankRect.width * 0.2, 
        y: bankRect.height * 0.8 
      };
      
      this.entrancePosition = {
        x: 30,
        y: bankRect.height / 2
      };
      
      this.exitPosition = {
        x: 30,
        y: bankRect.height / 2
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
      
      const animate = (timestamp) => {
        if (!this.lastUpdateTime) this.lastUpdateTime = timestamp;
        const deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        
        this.updateClients(deltaTime);
        
        if (this.isRunning) {
          this.animationFrame = requestAnimationFrame(animate);
        }
      };
      
      this.animationFrame = requestAnimationFrame(animate);
      
      this.intervals.push(setInterval(() => {
        if (this.bank.isWindingDown) return;
        
        const client = new Client();
        
        if (Math.random() < this.vipPercentage/100) {
          client.type = 'vip';
        }
        
        client.position = { 
          x: this.entrancePosition.x - 40, 
          y: this.entrancePosition.y 
        };
        client.targetPosition = { ...this.entrancePosition };
        
        this.enteringClients.push(client);
        this.totalEntered++;
        
        setTimeout(() => {
          this.assignClientToQueue(client);
          this.enteringClients = this.enteringClients.filter(c => c.id !== client.id);
        }, 1000);
      }, this.arrivalRate));
      
      this.intervals.push(setInterval(() => {
        this.serveQueues();
      }, 100));
      
      this.intervals.push(setInterval(() => {
        this.checkLeavingClients();
      }, 500));
    },
    
    assignClientToQueue(client) {
      if (client.type === 'vip') {
        if (this.hasSpecialCounters('vip') || !this.hasSpecialCounters('regular')) {
          this.bank.vipQueue.push(client);
          client.targetPosition = { 
            x: this.vipQueuePosition.x - (this.bank.vipQueue.length - 1) * 30,
            y: this.vipQueuePosition.y
          };
        } else {
          this.addToRegularQueue(client);
        }
      } 
      else if (client.type === 'pensioner') {
        if (this.hasSpecialCounters('pensioner') || !this.hasSpecialCounters('regular')) {
          this.bank.pensionerQueue.push(client);
          client.targetPosition = { 
            x: this.pensionerQueuePosition.x - (this.bank.pensionerQueue.length - 1) * 30,
            y: this.pensionerQueuePosition.y
          };
        } else {
          this.addToRegularQueue(client);
        }
      }
      else {
        if (!this.atmBroken && Math.random() < 0.3 && 
            (client.serviceType === 'payment' || client.serviceType === 'deposit')) {
          this.processAtmClient(client);
        } else {
          this.addToRegularQueue(client);
        }
      }
    },
    
    updateClients(deltaTime) {
      const speedFactor = deltaTime / 16;
      
      this.enteringClients.forEach(client => {
        this.moveClient(client, speedFactor);
      });
      
      this.bank.vipQueue.forEach((client, index) => {
        client.targetPosition = {
          x: this.vipQueuePosition.x - index * 30,
          y: this.vipQueuePosition.y
        };
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      
      this.bank.pensionerQueue.forEach((client, index) => {
        client.targetPosition = {
          x: this.pensionerQueuePosition.x - index * 30,
          y: this.pensionerQueuePosition.y
        };
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      
      this.queuePositions.forEach((client, index) => {
        client.targetPosition = {
          x: this.mainQueuePosition.x - index * 30,
          y: this.mainQueuePosition.y
        };
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      
      this.atmClients.forEach(client => {
        this.moveClient(client, speedFactor);
      });
      
      this.servingClients.forEach(client => {
        this.moveClient(client, speedFactor);
      });
      
      this.leavingClients.forEach(client => {
        client.leaveProgress = Math.max(0, client.leaveProgress - 0.01 * speedFactor);
        this.moveClient(client, speedFactor);
        
        if (client.leaveProgress <= 0) {
          this.leavingClients = this.leavingClients.filter(c => c.id !== client.id);
        }
      });
    },
    
    moveClient(client, speedFactor = 1) {
      const dx = client.targetPosition.x - client.position.x;
      const dy = client.targetPosition.y - client.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 2) {
        const speed = client.speed * speedFactor;
        client.position.x += dx * 0.05 * speed;
        client.position.y += dy * 0.05 * speed;
      } else {
        client.position = { ...client.targetPosition };
      }
    },
    
    serveQueues() {
      if (this.hasSpecialCounters('vip')) {
        const availableVipCounter = this.bank.counters.find(c => 
          c.type === 'vip' && c.isAvailable && c.isWorking
        );
        if (availableVipCounter && this.bank.vipQueue.length > 0) {
          const client = this.bank.vipQueue.shift();
          this.serveClient(client, availableVipCounter);
          return;
        }
      }

      if (this.hasSpecialCounters('pensioner')) {
        const availablePensionerCounter = this.bank.counters.find(c => 
          c.type === 'pensioner' && c.isAvailable && c.isWorking
        );
        if (availablePensionerCounter && this.bank.pensionerQueue.length > 0) {
          const client = this.bank.pensionerQueue.shift();
          this.serveClient(client, availablePensionerCounter);
          return;
        }
      }

      const availableRegularCounter = this.bank.counters.find(c => 
        c.type === 'regular' && c.isAvailable && c.isWorking
      );
      
      if (!this.hasSpecialCounters('vip') && this.bank.vipQueue.length > 0) {
        const client = this.bank.vipQueue.shift();
        this.serveClient(client, availableRegularCounter);
        return;
      }
      
      if (!this.hasSpecialCounters('pensioner') && this.bank.pensionerQueue.length > 0) {
        const client = this.bank.pensionerQueue.shift();
        this.serveClient(client, availableRegularCounter);
        return;
      }
      
      if (availableRegularCounter && this.queuePositions.length > 0) {
        const client = this.queuePositions.shift();
        this.serveClient(client, availableRegularCounter);
      }
    },
    
    async serveClient(client, counter) {
      counter.isAvailable = false;
      counter.currentClient = client;
      client.isServing = true;
      this.servingClients.push(client);
      
      client.targetPosition = {
        x: counter.position.x - 30,
        y: counter.position.y
      };
      
      await this.waitForPosition(client);
      
      await new Promise(resolve => 
        setTimeout(resolve, client.serviceTime * (100/this.serviceSpeed))
      );
      
      client.targetPosition = { ...this.exitPosition };
      await this.waitForPosition(client);
      
      counter.isAvailable = true;
      counter.currentClient = null;
      this.servingClients = this.servingClients.filter(c => c.id !== client.id);
      this.bank.totalServed++;
      
      this.makeClientLeave(client);
    },
    
    processAtmClient(client) {
      client.position = { ...this.entrancePosition };
      client.targetPosition = { ...this.atmPosition };
      this.atmClients.push(client);
      
      setTimeout(() => {
        this.atmClients = this.atmClients.filter(c => c.id !== client.id);
        this.makeClientLeave(client);
        this.bank.totalServed++;
      }, 3000 * (100/this.serviceSpeed));
    },
    
    addToRegularQueue(client) {
      client.position = { ...this.entrancePosition };
      client.targetPosition = {
        x: this.mainQueuePosition.x - this.queuePositions.length * 30,
        y: this.mainQueuePosition.y
      };
      this.queuePositions.push(client);
    },
    
    async makeClientLeave(client) {
      client.isLeaving = true;
      client.leaveProgress = 1;
      client.targetPosition = { ...this.exitPosition };
      this.leavingClients.push(client);
      
      this.bank.vipQueue = this.bank.vipQueue.filter(c => c.id !== client.id);
      this.bank.pensionerQueue = this.bank.pensionerQueue.filter(c => c.id !== client.id);
      this.queuePositions = this.queuePositions.filter(c => c.id !== client.id);
      this.atmClients = this.atmClients.filter(c => c.id !== client.id);
      this.servingClients = this.servingClients.filter(c => c.id !== client.id);
      
      await this.waitForPosition(client);
    },
    
    checkLeavingClients() {
      this.bank.vipQueue = this.bank.vipQueue.filter(client => {
        if (Math.random() < this.leaveChance/10000 * (100 - client.patienceLevel)) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });
      
      this.bank.pensionerQueue = this.bank.pensionerQueue.filter(client => {
        if (Math.random() < this.leaveChance/8000 * (100 - client.patienceLevel)) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });
      
      this.queuePositions = this.queuePositions.filter(client => {
        if (Math.random() < this.leaveChance/5000 * (100 - client.patienceLevel)) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });
    },
    
    waitForPosition(client) {
      return new Promise(resolve => {
        const check = () => {
          const dx = client.position.x - client.targetPosition.x;
          const dy = client.position.y - client.targetPosition.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 5) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
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
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
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
      this.enteringClients = [];
      this.leavingClients = [];
      this.servingClients = [];
      this.randomEventActive = false;
      this.lastUpdateTime = 0;
      this.initializeCounters();
    }
  }
};
</script>