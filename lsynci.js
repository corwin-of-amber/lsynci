#!/usr/bin/env node
const fs = require('fs'),
      events = require('events'),
      child_process = require('child_process'),
      minimatch = require('minimatch'),
      debounce = require('throttle-debounce').debounce;



class Watch extends events.EventEmitter {

    constructor() {
        super();
        
        this.common_root = undefined;
        this.watchers = [];

        this.glob_opts = {dot: true};
        this.excluded = [];

        this.notify = debounce(200, () => this._notify());
        this.queue = new Set();
    }

    add(dir, recursive=true) {
        var handler = (event, filename) => {
            if (!this.isExcluded(filename)) {
                console.log('*', filename);  /* `event` is unreliable */
                this.queue.add(dir);
                this.notify();
            }
        };

        var watcher = fs.watch(dir, {persistent: true, recursive: true}, 
            handler);

        this.watchers.push(watcher);
    }

    exclude(...globs) {
        this.excluded.push(...globs.map(pat => 
            new minimatch.Minimatch(pat, this.glob_opts)));
    }

    _notify() {
        var msg = [...this.queue]
        console.log("--- notify ---", msg);
        this.emit('change', msg);
        this.queue.clear();
    }

    isExcluded(filename) {
        return this.excluded.some(mm => mm.match(filename));
    }

}


class CommandSync {

    constructor(command) {
        this.command = command;
        this.opts = {shell: true, stdio: 'inherit'};
    }

    invoke(msg) {
        child_process.spawn(this.command, this.opts);
    }

}



if (module.id === '.') {
    var excludes = ['**/.*', '**/_*', '**/node_modules'],
        opts = require('commander')
        .option('-x, --exclude <path>',     'directories or patterns to exclude')
        .option('-c, --command <cmd>',      'command to execute when watched files are changed')
        .on('option:exclude', e => excludes.push(e))
        .parse(process.argv);

    var w = new Watch();

    w.add('.');

    w.exclude(...excludes.map(x => `${x}{,/**}`));

    if (opts.command) {
        var c = new CommandSync(opts.command);
        w.on('change', msg => c.invoke(msg));
    }
}

