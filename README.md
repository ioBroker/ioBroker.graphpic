![Logo](admin/graphpic.png)
# Grafpic adapter for Gefasoft project

Connects Gefasoft with graphpic. 

## Install

```iobroker add graphpic```

### Configuration

- Connection link: normally http://localhost:8000, address where plugin HMI 4.0 is wating for connection
- Own IP address: ip address of "gefasoft", where grahpic can reach "gefasoft.graphpic" adapter.
- Own port: default 8001
- Reconnect timeout: default 30000ms
- Timeout-KeepAlive: default 30000ms
- Subscribe list: list of groups, for that gefasoft.graphpic wants to receive the values

## Changelog

### 0.0.1 (2016-01-24)
* (bluefox) Intial checkin

## License

The MIT License (MIT)

Copyright (c) 2016 bluefox (License must be cleared)!!!

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

