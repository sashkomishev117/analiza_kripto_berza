class MarketUpdater {
    constructor(updateFn) {
        this.updateFn = updateFn;
        this.observers = [];
    }

    subscribe(observer) {
        this.observers.push(observer);
    }

    notify() {
        for (const obs of this.observers) {
            obs.onMarketUpdated();
        }
    }

    async update() {
        try {
            await this.updateFn();
            this.notify();
        } catch (e) {
            console.error('MarketUpdater update error:', e);
            throw e;
        }
    }
}

module.exports = MarketUpdater;
