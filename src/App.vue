<template>
  <div class="bank-simulation">
    <h1>Имитация очереди в банке</h1>
    
    <div class="controls">
      <div class="slider-group">
        <label>Количество окон: {{ counterCount }}</label>
        <input type="range" min="1" max="10" v-model.number="counterCount" :disabled="isRunning">
      </div>
      
      <div class="slider-group">
        <label>Скорость обработки: {{ processSpeed }} мс</label>
        <input type="range" min="1000" max="10000" step="100" v-model.number="processSpeed" :disabled="isRunning">
      </div>
      
      <div class="slider-group">
        <label>Скорость прихода: {{ arrivalRate }} мс</label>
        <input type="range" min="100" max="2000" step="50" v-model.number="arrivalRate" :disabled="isRunning">
      </div>
      
      <div class="slider-group">
        <label>Макс. клиентов: {{ maxCustomers }}</label>
        <input type="range" min="5" max="50" v-model.number="maxCustomers" :disabled="isRunning">
      </div>
      
      <div class="button-group">
        <button @click="startSimulation" :disabled="isRunning">Старт</button>
        <button @click="stopSimulation" :disabled="!isRunning">Стоп</button>
        <button @click="resetSimulation">Сброс</button>
      </div>
    </div>
    
    <div class="stats">
      <div>Клиентов в банке: {{ bank.clients.length }} / {{ maxCustomers }}</div>
      <div>Свободных окон: {{ availableCounters }}</div>
      <div>Обслужено: {{ bank.totalServed }} / {{ maxCustomers }}</div>
      <div v-if="bank.isWindingDown" class="simulation-winding">Завершение работы...</div>
      <div v-if="simulationFinished" class="simulation-finished">Симуляция завершена!</div>
    </div>
    
    <div class="bank-visualization" ref="bankArea">
      <div class="bank-walls">
        <div class="entrance-door"></div>
        
        <div 
          v-for="counter in bank.counters" 
          :key="counter.id"
          class="service-window"
          :style="{
            left: counter.position.x + 'px',
            top: counter.position.y + 'px',
            backgroundColor: this.queuePositions[counter.id-1]?.length > 0 ? '#F44336' : '#4CAF50'
          }"
        >
          <span v-if="counter.currentClient">⏱️</span>
          <span v-else>👔</span>
        </div>
        
        <div 
          v-for="client in bank.clients" 
          :key="client.id"
          class="client"
          :class="{ 
            'client-waiting': client.isWaiting,
            'client-leaving': client.isLeaving
          }"
          :style="{
            left: client.position.x + 'px',
            top: client.position.y + 'px'
          }"
        >
          <span class="client-emoji">🧍</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Bank, Counter, Client } from './models/Bank';

export default {
  data() {
    return {
      bank: new Bank(50),
      counterCount: 3,
      processSpeed: 3000,
      arrivalRate: 500,
      maxCustomers: 20,
      isRunning: false,
      simulationFinished: false,
      intervals: [],
      totalEntered: 0,
      queuePositions: [],
      isDrainingQueues: false
    };
  },
  computed: {
    availableCounters() {
      return this.bank.counters.filter(c => c.isAvailable).length;
    }
  },
  watch: {
    counterCount(newVal) {
      this.initializeCounters(newVal);
    },
    processSpeed(newVal) {
      this.bank.counters.forEach(c => c.processTime = newVal);
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
    initializeCounters(count = this.counterCount) {
      this.bank.counters = Array.from({ length: count }, (_, i) => {
        return new Counter(i + 1, this.processSpeed);
      });
      this.queuePositions = Array(count).fill().map(() => []);
      this.positionCounters();
    },
    
    positionCounters() {
      if (!this.$refs.bankArea) {
        setTimeout(this.positionCounters, 100);
        return;
      }
      
      const bankRect = this.$refs.bankArea.getBoundingClientRect();
      const offset = 70;
      const queueSpacing = 30;
      
      this.bank.counters.forEach((counter, i) => {
        counter.position = {
          x: bankRect.width - offset,
          y: offset + i * (bankRect.height - 2 * offset) / this.counterCount
        };
        
        this.queuePositions[i].forEach((client, pos) => {
          client.targetPosition = {
            x: counter.position.x - 30 - (pos * queueSpacing),
            y: counter.position.y
          };
        });
      });
    },
    
    setupBankDimensions() {
      this.$nextTick(this.positionCounters);
    },
    
    startSimulation() {
      this.resetSimulation();
      this.isRunning = true;
      this.simulationFinished = false;
      this.bank.isWindingDown = false;
      
      // Добавление новых клиентов
      this.intervals.push(setInterval(() => {
        if (this.bank.clients.length >= this.maxCustomers || 
            this.bank.isWindingDown ||
            this.bank.totalServed >= this.maxCustomers) return;
            
        const client = new Client();
        client.position = { 
          x: 50, 
          y: this.$refs.bankArea.clientHeight / 2 
        };
        
        // Находим окно с самой короткой очередью
        let shortestQueueIndex = 0;
        let shortestQueueLength = this.queuePositions[0].length;
        
        for (let i = 1; i < this.counterCount; i++) {
          if (this.queuePositions[i].length < shortestQueueLength) {
            shortestQueueIndex = i;
            shortestQueueLength = this.queuePositions[i].length;
          }
        }
        
        // Добавляем клиента в очередь
        this.queuePositions[shortestQueueIndex].push(client);
        client.targetCounter = this.bank.counters[shortestQueueIndex].id;
        client.isWaiting = true;
        
        // Позиция в очереди
        client.targetPosition = {
          x: this.bank.counters[shortestQueueIndex].position.x - 30 - (shortestQueueLength * 30),
          y: this.bank.counters[shortestQueueIndex].position.y
        };
        
        this.bank.clients.push(client);
        this.totalEntered++;
        
      }, this.arrivalRate));
      
      // Основной цикл
      this.intervals.push(setInterval(() => {
        // Обработка движения клиентов
        this.bank.clients.forEach(client => {
          if (!client.targetPosition) return;
          
          const dx = client.targetPosition.x - client.position.x;
          const dy = client.targetPosition.y - client.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 2) {
            client.position.x += (dx / distance) * client.speed;
            client.position.y += (dy / distance) * client.speed;
          }
        });
        
        // Назначение клиентов к свободным окнам
        if (!this.bank.isWindingDown && !this.isDrainingQueues) {
          this.bank.counters.forEach((counter, i) => {
            if (counter.isAvailable && this.queuePositions[i].length > 0) {
              const nextClient = this.queuePositions[i][0];
              if (nextClient) {
                this.serveClient(nextClient, counter);
              }
            }
          });
        }
        
        // Проверка завершения
        if (!this.isDrainingQueues && this.bank.totalServed >= this.maxCustomers) {
          this.startWindingDown();
        }
      }, 16));
    },
    
    async serveClient(client, counter) {
      // Удаляем клиента из очереди
      const queueIndex = this.queuePositions[counter.id - 1].indexOf(client);
      if (queueIndex >= 0) {
        this.queuePositions[counter.id - 1].splice(queueIndex, 1);
      }
      
      // Обновляем позиции оставшихся в очереди
      this.updateQueuePositions();
      
      // Начинаем обслуживание
      counter.isAvailable = false;
      counter.currentClient = client;
      
      // Клиент подходит к окну
      client.targetPosition = {
        x: counter.position.x - 15,
        y: counter.position.y
      };
      
      // Ждем пока подойдет
      await this.waitForClientToReachPosition(client);
      
      // Имитация времени обслуживания
      await new Promise(resolve => setTimeout(resolve, counter.processTime));
      
      // Обслуживание завершено
      client.served = true;
      this.bank.totalServed = Math.min(this.bank.totalServed + 1, this.maxCustomers);
      
      // Клиент уходит
      await this.makeClientLeave(client);
      
      counter.isAvailable = true;
      counter.currentClient = null;
    },
    
    startWindingDown() {
      this.bank.isWindingDown = true;
      clearInterval(this.intervals[0]);
      this.drainQueues();
    },
    
    async drainQueues() {
      this.isDrainingQueues = true;
      
      // Обрабатываем все очереди
      for (let i = 0; i < this.queuePositions.length; i++) {
        // Удаляем клиентов из очереди с конца к началу
        while (this.queuePositions[i].length > 0) {
          const client = this.queuePositions[i].pop();
          await this.makeClientLeave(client);
          this.updateQueuePositions();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      // После опустошения всех очередей завершаем симуляцию
      this.finishSimulation();
      this.isDrainingQueues = false;
    },
    
    async makeClientLeave(client) {
      client.isLeaving = true;
      client.targetPosition = {
        x: 30,
        y: this.$refs.bankArea.clientHeight / 2
      };
      
      await this.waitForClientToReachPosition(client);
      this.bank.clients = this.bank.clients.filter(c => c.id !== client.id);
    },
    
    updateQueuePositions() {
      this.bank.counters.forEach((counter, i) => {
        this.queuePositions[i].forEach((client, pos) => {
          client.targetPosition = {
            x: counter.position.x - 30 - (pos * 30),
            y: counter.position.y
          };
        });
      });
    },
    
    waitForClientToReachPosition(client) {
      return new Promise(resolve => {
        const checkPosition = () => {
          const dx = client.targetPosition.x - client.position.x;
          const dy = client.targetPosition.y - client.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 2) {
            resolve();
          } else {
            setTimeout(checkPosition, 50);
          }
        };
        checkPosition();
      });
    },
    
    stopSimulation() {
      this.intervals.forEach(clearInterval);
      this.intervals = [];
      this.isRunning = false;
    },
    
    finishSimulation() {
      this.stopSimulation();
      this.simulationFinished = true;
      this.bank.isWindingDown = false;
    },
    
    resetSimulation() {
      this.stopSimulation();
      this.bank = new Bank(50);
      this.bank.totalServed = 0;
      this.totalEntered = 0;
      this.simulationFinished = false;
      this.bank.isWindingDown = false;
      this.isDrainingQueues = false;
      this.queuePositions = [];
      this.initializeCounters();
    }
  }
};
</script>

<style scoped>
.bank-simulation {
  font-family: Arial, sans-serif;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.controls {
  margin: 20px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.slider-group {
  margin-bottom: 15px;
}

.slider-group label {
  display: block;
  margin-bottom: 5px;
}

.slider-group input {
  width: 100%;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

button {
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #cccccc;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin: 20px 0;
  padding: 10px;
  background: #e8f5e9;
  border-radius: 8px;
}

.simulation-winding {
  color: #FF9800;
  font-weight: bold;
}

.simulation-finished {
  color: #4CAF50;
  font-weight: bold;
}

.bank-visualization {
  position: relative;
  width: 100%;
  height: 500px;
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
  background-color: #8D6E63;
  border: 2px solid #5D4037;
}

.service-window {
  position: absolute;
  width: 50px;
  height: 80px;
  background-color: #4CAF50;
  border: 2px solid #2E7D32;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  z-index: 2;
  transition: background-color 0.3s ease;
}

.client {
  position: absolute;
  width: 30px;
  height: 30px;
  transform: translate(-50%, -50%);
  transition: left 0.3s ease-out, top 0.3s ease-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

.client-emoji {
  font-size: 24px;
  margin-bottom: 2px;
  filter: drop-shadow(0 0 2px rgba(0,0,0,0.3));
}

.client-waiting .client-emoji {
  animation: pulse 1s infinite alternate;
}

.client-leaving {
  opacity: 0.7;
  transform: translate(-50%, -50%) scale(0.9);
  transition: all 0.5s ease-out;
}

@keyframes pulse {
  from { transform: scale(1); }
  to { transform: scale(1.1); }
}
</style>