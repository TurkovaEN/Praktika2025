<template>
  <div class="bank-simulation">
    <h1>Имитация очереди в банке</h1>
    
    <div class="controls">
      <div class="slider-group">
        <label>Количество окон: {{ counterCount }}</label>
        <input type="range" min="1" max="10" v-model.number="counterCount">
      </div>
      
      <div class="slider-group">
        <label>Скорость обработки: {{ processSpeed }} мс</label>
        <input type="range" min="500" max="5000" step="100" v-model.number="processSpeed">
      </div>
      
      <div class="slider-group">
        <label>Скорость прихода клиентов: {{ arrivalRate }} сек</label>
        <input type="range" min="1" max="10" v-model.number="arrivalRate">
      </div>
      
      <div class="slider-group">
        <label>Макс. клиентов: {{ maxCapacity }}</label>
        <input type="range" min="5" max="50" v-model.number="maxCapacity">
      </div>
      
      <button @click="startSimulation">Старт</button>
      <button @click="stopSimulation">Стоп</button>
    </div>
    
    <div class="stats">
      <div>Клиентов в банке: {{ bank.clients.length }}</div>
      <div>Свободных окон: {{ availableCounters }}</div>
      <div>Обслужено: {{ servedClients }}</div>
    </div>
    
    <div class="bank-visualization" ref="bankArea">
      <div class="bank-hall">
        <div 
          v-for="client in bank.clients" 
          :key="client.id"
          class="client"
          :style="{
            left: client.position.x + 'px',
            top: client.position.y + 'px',
            backgroundColor: `hsl(${client.id * 10 % 360}, 70%, 50%)`
          }"
        ></div>
      </div>
      
      <div 
        v-for="counter in bank.counters" 
        :key="counter.id"
        class="counter"
        :style="{
          left: counter.position.x + 'px',
          top: counter.position.y + 'px',
          backgroundColor: counter.isAvailable ? '#4CAF50' : '#F44336'
        }"
      >
        <span v-if="counter.currentClient">🕒</span>
      </div>
    </div>
  </div>
</template>

<script>
import { Bank, Counter, Client } from './models/Bank';

export default {
  data() {
    return {
      bank: new Bank(20),
      counterCount: 3,
      processSpeed: 2000,
      arrivalRate: 3,
      maxCapacity: 30,
      servedClients: 0,
      simulationInterval: null,
      clientInterval: null,
      animationFrame: null
    };
  },
  computed: {
    availableCounters() {
      return this.bank.counters.filter(c => c.isAvailable).length;
    }
  },
  watch: {
    counterCount: {
      handler(newVal) {
        this.initializeCounters(newVal);
      },
      immediate: true
    },
    processSpeed(newVal) {
      this.bank.counters.forEach(counter => {
        counter.processTime = newVal;
      });
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
    cancelAnimationFrame(this.animationFrame);
  },
  methods: {
    initializeCounters(newCount = this.counterCount) {
      this.bank.counters = Array.from({ length: newCount }, (_, i) => {
        return new Counter(i + 1, this.processSpeed);
      });
      this.positionCounters();
    },
    
    positionCounters() {
      if (!this.$refs.bankArea) return;
      
      const bankWidth = this.$refs.bankArea.clientWidth;
      const bankHeight = this.$refs.bankArea.clientHeight;
      
      this.bank.counters.forEach((counter, index) => {
        counter.position = {
          x: bankWidth - 60,
          y: 50 + index * (bankHeight - 100) / this.counterCount
        };
      });
    },
    
    setupBankDimensions() {
      this.$nextTick(() => {
        this.positionCounters();
      });
    },
    
    startSimulation() {
      this.stopSimulation();
      this.bank = new Bank(this.maxCapacity);
      this.servedClients = 0;
      this.initializeCounters();
      
      this.clientInterval = setInterval(() => {
        if (this.bank.clients.length < this.maxCapacity) {
          const client = new Client();
          client.position = { 
            x: 30, 
            y: 30 + Math.random() * (this.$refs.bankArea.clientHeight - 60) 
          };
          
          const freeCounter = this.bank.counters.find(c => c.isAvailable);
          if (freeCounter) {
            client.targetPosition = { 
              x: freeCounter.position.x - 30,
              y: freeCounter.position.y
            };
          } else {
            client.targetPosition = {
              x: 50 + Math.random() * (this.$refs.bankArea.clientWidth - 150),
              y: 50 + Math.random() * (this.$refs.bankArea.clientHeight - 100)
            };
          }
          
          this.bank.addClient(client);
          
          if (freeCounter) {
            this.serveClient(client, freeCounter);
          }
        }
      }, this.arrivalRate * 1000);
      
      const animate = () => {
        this.bank.clients.forEach(client => {
          client.move();
          
          if (client.targetPosition) {
            const dx = client.targetPosition.x - client.position.x;
            const dy = client.targetPosition.y - client.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 5) {
              const counter = this.bank.counters.find(c => 
                !c.isAvailable && !c.currentClient
              );
              
              if (counter) {
                this.serveClient(client, counter);
              }
            }
          }
        });
        
        this.animationFrame = requestAnimationFrame(animate);
      };
      
      animate();
    },
    
    async serveClient(client, counter) {
      await counter.serveClient(client);
      this.bank.removeClient(client.id);
      this.servedClients++;
      
      const waitingClient = this.bank.clients.find(c => 
        !c.targetPosition || 
        (Math.abs(c.targetPosition.x - (counter.position.x - 30)) < 5 &&
         Math.abs(c.targetPosition.y - counter.position.y) < 5)
      );
      
      if (waitingClient) {
        waitingClient.targetPosition = { 
          x: counter.position.x - 30,
          y: counter.position.y
        };
        this.serveClient(waitingClient, counter);
      }
    },
    
    stopSimulation() {
      clearInterval(this.simulationInterval);
      clearInterval(this.clientInterval);
      cancelAnimationFrame(this.animationFrame);
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

button {
  padding: 8px 16px;
  margin-right: 10px;
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
  justify-content: space-around;
  margin: 20px 0;
  padding: 10px;
  background: #e8f5e9;
  border-radius: 8px;
}

.bank-visualization {
  position: relative;
  width: 100%;
  height: 500px;
  border: 2px solid #333;
  border-radius: 8px;
  overflow: hidden;
}

.bank-hall {
  width: 100%;
  height: 100%;
  background-color: #f9f9f9;
}

.client {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: left 0.1s linear, top 0.1s linear;
}

.counter {
  position: absolute;
  width: 40px;
  height: 80px;
  background-color: #4CAF50;
  border: 2px solid #333;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
</style>