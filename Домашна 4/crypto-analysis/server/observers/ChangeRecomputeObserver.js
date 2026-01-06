class ChangeRecomputeObserver {
    constructor(recomputeFn) {
        this.recomputeFn = recomputeFn;
    }

    onMarketUpdated() {
        this.recomputeFn();
    }
}

module.exports = ChangeRecomputeObserver;
