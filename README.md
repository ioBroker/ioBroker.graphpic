![Logo](admin/graphpic.png)
# ioBroker.graphpic
==================

## Graphpic Adapter for Gefasoft project

Connects ioBroker with graphpic. 

## Install
```
npm install https://github.com/Gefasoft/HMI4.0.graphpic/tarball/master
iobroker add graphpic
```

### Configuration

- Connection link: URI of Plugin in Graphpic, like "http://localhost:8000"
- Own IP address: Own IP address, where Graphpic can reach the ioBroker.Default 127.0.0.1,
- Own port: Own TCP port, where adapter expects requests from Graphpic. Default 8001,
- Reconnect timeout: Interval between connect attempts. Default 30000
- Timeout-KeepAlive: Timeout for ping. Gefasoft sends every X seconds a ping command. If no ping in given time received, reconnect. Default 30000
- Subscribe list: List of variables, that must be subscribed every time by reconnect, like: Group1.Item1, Group1.Item2, Group2.Item1

## Changelog

### 0.2.2  (2017-01-14)
* (bluefox) Mark 0.0.0.0 as invalid

### 0.2.1  (2016-12-21)
* (bluefox) fix error with splitted packets
* (bluefox) add in/out rates

### 0.2.0  (2016-11-20)
* (gh-god) batch send

### 0.1.1  (2016-10-11)
* (bluefox) fix localhost issue

### 0.1.0  (2016-03-09)
* (bluefox) add quality

### 0.0.2  (2016-02-05)
* (bluefox) Fix subscribe on connection change, on restart

### 0.0.1  (2016-01-24)
* (bluefox) Intial checkin

## License

Copyright (c) 2017 ioBroker. 

ioBroker.graphpic (c) by ioBroker

ioBroker.graphpic is licensed under a
Creative Commons Attribution-NonCommercial 4.0 International License.

You should have received a copy of the license along with this
work. If not, see <http://creativecommons.org/licenses/by-nc/4.0/>.


