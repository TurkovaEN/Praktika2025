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
        <div class="atm" :style="atmStyle">🏧</div>
        
        <!-- Окна обслуживания -->
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
        
        <!-- Клиенты -->
        <transition-group name="client" tag="div">
          <!-- Входящие клиенты -->
          <div
            v-for="client in enteringClients"
            :key="'entering-'+client.id"
            class="client entering-client"
            :style="{
              left: client.position.x + 'px',
              top: client.position.y + 'px',
              transform: 'translate(-50%, -50%)',
              zIndex: 10
            }"
          >
            <span class="client-emoji">{{ client.type === 'vip' ? '🎩' : client.type === 'pensioner' ? '👵' : '🧍' }}</span>
          </div>
          
          <!-- VIP очередь -->
          <div 
            v-for="(client, index) in bank.vipQueue" 
            :key="'vip-'+client.id"
            class="client vip-client"
            :style="{
              left: (vipQueuePosition.x - index * 30) + 'px',
              top: vipQueuePosition.y + 'px',
              opacity: client.patienceLevel/100,
              transform: 'translate(-50%, -50%)'
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
              opacity: client.patienceLevel/100,
              transform: 'translate(-50%, -50%)'
            }"
          >
            <span class="client-emoji">👵</span>
            <div class="client-status">{{ client.serviceType }}</div>
            <div class="emotion-indicator" :class="client.emotion"></div>
          </div>
          
          <!-- Основная очередь -->
          <div 
            v-for="(client, index) in queuePositions" 
            :key="client.id"
            class="client"
            :class="{
              'serving-client': client.isServing,
              [client.emotion]: true
            }"
            :style="{
              left: (mainQueuePosition.x - index * 30) + 'px',
              top: mainQueuePosition.y + 'px',
              opacity: client.isServing ? 0.7 : client.patienceLevel/100,
              transform: 'translate(-50%, -50%)'
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
              top: client.position.y + 'px',
              transform: 'translate(-50%, -50%)'
            }"
          >
            <span class="client-emoji">💳</span>
          </div>
          
          <!-- Уходящие клиенты -->
          <div
            v-for="client in leavingClients"
            :key="'leaving-'+client.id"
            class="client leaving-client"
            :style="{
              left: client.position.x + 'px',
              top: client.position.y + 'px',
              transform: 'translate(-50%, -50%)',
              opacity: client.leaveProgress,
              zIndex: 5
            }"
          >
            <span class="client-emoji">{{ client.type === 'vip' ? '🎩' : client.type === 'pensioner' ? '👵' : '🧍' }}</span>
          </div>
        </transition-group>
      </div>
    </div>
  </div>
</template>

<script>
import './BankSimulation.css';
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
      animationFrame: null,
      lastUpdateTime: 0,
      totalEntered: 0,
      leftClients: 0,
      queuePositions: [],
      atmClients: [],
      enteringClients: [],
      leavingClients: [],
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
             this.leavingClients.length;
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
      
      // Позиционирование окон
      this.bank.counters.forEach((counter, i) => {
        counter.position = {
          x: bankRect.width - offset,
          y: offset + i * spacing
        };
      });
      
      // Позиционирование других элементов
      this.vipQueuePosition = { 
        x: bankRect.width * 0.7, 
        y: bankRect.height * 0.2 
      };
      
      this.pensionerQueuePosition = { 
        x: bankRect.width * 0.7, 
        y: bankRect.height * 0.8 
      };
      
      this.mainQueuePosition = {
        x: bankRect.width * 0.7,
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
      
      // Анимационный цикл
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
      
      // Добавление новых клиентов
      this.intervals.push(setInterval(() => {
        if (this.bank.isWindingDown) return;
        
        const client = new Client();
        
        // Принудительно делаем VIP по настройке
        if (Math.random() < this.vipPercentage/100) {
          client.type = 'vip';
        }
        
        // Начальная позиция за пределами банка
        client.position = { 
          x: this.entrancePosition.x - 40, 
          y: this.entrancePosition.y 
        };
        client.targetPosition = { ...this.entrancePosition };
        
        this.enteringClients.push(client);
        this.totalEntered++;
        
        // Через 1 сек добавляем в соответствующую очередь
        setTimeout(() => {
          this.assignClientToQueue(client);
          this.enteringClients = this.enteringClients.filter(c => c.id !== client.id);
        }, 1000);
      }, this.arrivalRate));
      
      // Логика обслуживания
      this.intervals.push(setInterval(() => {
        this.serveQueues();
      }, 100));
      
      // Проверка ухода клиентов
      this.intervals.push(setInterval(() => {
        this.checkLeavingClients();
      }, 500));
    },
    
    assignClientToQueue(client) {
      if (client.type === 'vip') {
        this.bank.vipQueue.push(client);
        client.targetPosition = { 
          x: this.vipQueuePosition.x - (this.bank.vipQueue.length - 1) * 30,
          y: this.vipQueuePosition.y
        };
      } 
      else if (client.type === 'pensioner') {
        this.bank.pensionerQueue.push(client);
        client.targetPosition = { 
          x: this.pensionerQueuePosition.x - (this.bank.pensionerQueue.length - 1) * 30,
          y: this.pensionerQueuePosition.y
        };
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
      const speedFactor = deltaTime / 16; // Нормализация скорости
      
      // Входящие клиенты
      this.enteringClients.forEach(client => {
        this.moveClient(client, speedFactor);
      });
      
      // VIP очередь
      this.bank.vipQueue.forEach((client, index) => {
        client.targetPosition = {
          x: this.vipQueuePosition.x - index * 30,
          y: this.vipQueuePosition.y
        };
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      
      // Пенсионерская очередь
      this.bank.pensionerQueue.forEach((client, index) => {
        client.targetPosition = {
          x: this.pensionerQueuePosition.x - index * 30,
          y: this.pensionerQueuePosition.y
        };
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      
      // Основная очередь
      this.queuePositions.forEach((client, index) => {
        client.targetPosition = {
          x: this.mainQueuePosition.x - index * 30,
          y: this.mainQueuePosition.y
        };
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      
      // Клиенты у терминала
      this.atmClients.forEach(client => {
        this.moveClient(client, speedFactor);
      });
      
      // Уходящие клиенты
      this.leavingClients.forEach(client => {
        client.leaveProgress = Math.max(0, client.leaveProgress - 0.01 * speedFactor);
        this.moveClient(client, speedFactor);
        
        // Удаляем когда полностью ушли
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
      
      // Подход к окну
      client.targetPosition = {
        x: counter.position.x - 20,
        y: counter.position.y
      };
      
      // Ждем пока подойдет
      await this.waitForPosition(client);
      
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
      
      // Удаляем из всех очередей
      this.bank.vipQueue = this.bank.vipQueue.filter(c => c.id !== client.id);
      this.bank.pensionerQueue = this.bank.pensionerQueue.filter(c => c.id !== client.id);
      this.queuePositions = this.queuePositions.filter(c => c.id !== client.id);
      this.atmClients = this.atmClients.filter(c => c.id !== client.id);
    },
    
    checkLeavingClients() {
      // Проверяем VIP очередь
      this.bank.vipQueue = this.bank.vipQueue.filter(client => {
        if (Math.random() < this.leaveChance/10000 * (100 - client.patienceLevel)) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });
      
      // Пенсионерская очередь
      this.bank.pensionerQueue = this.bank.pensionerQueue.filter(client => {
        if (Math.random() < this.leaveChance/8000 * (100 - client.patienceLevel)) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });
      
      // Основная очередь
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
      this.randomEventActive = false;
      this.lastUpdateTime = 0;
      this.initializeCounters();
    }
  }
};
</script>
