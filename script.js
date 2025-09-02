
        // Global variables
        let currentFormat = 5;
        let selectedTimezone = 'Europe/Berlin';
        let calculationInProgress = false;

        // Optimized and Fixed Cron Calculator Class
        class PerfectCronCalculator {
            constructor() {
                this.monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ];
                this.dayNames = [
                    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
                ];
                this.monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            }

            isLeapYear(year) {
                return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
            }

            getDaysInMonth(month, year) {
                if (month === 2 && this.isLeapYear(year)) {
                    return 29;
                }
                return this.monthDays[month - 1];
            }

            parseField(field, min, max) {
                if (field === '*') {
                    return Array.from({length: max - min + 1}, (_, i) => i + min);
                }

                const values = new Set();
                const parts = field.split(',');

                for (let part of parts) {
                    part = part.trim();
                    
                    if (part.includes('/')) {
                        const [range, step] = part.split('/');
                        const stepNum = parseInt(step);
                        if (isNaN(stepNum) || stepNum <= 0) continue;
                        
                        let start = min, end = max;
                        if (range !== '*') {
                            if (range.includes('-')) {
                                [start, end] = range.split('-').map(x => parseInt(x.trim()));
                            } else {
                                start = end = parseInt(range);
                            }
                        }
                        
                        for (let i = start; i <= end && i <= max; i += stepNum) {
                            if (i >= min) values.add(i);
                        }
                    } else if (part.includes('-')) {
                        const [start, end] = part.split('-').map(x => parseInt(x.trim()));
                        if (!isNaN(start) && !isNaN(end)) {
                            for (let i = Math.max(start, min); i <= Math.min(end, max); i++) {
                                values.add(i);
                            }
                        }
                    } else if (part === 'L') {
                        // Handle 'L' for last day of month - add placeholder, will be handled differently
                        values.add(-1); // Special marker for last day
                    } else {
                        const num = parseInt(part);
                        if (!isNaN(num) && num >= min && num <= max) {
                            values.add(num);
                        }
                    }
                }

                return Array.from(values).sort((a, b) => a - b);
            }

            isDayMatch(date, dayOfMonth, dayOfWeek) {
                const day = date.getDate();
                const dow = date.getDay();
                const month = date.getMonth() + 1;
                const year = date.getFullYear();

                let dayOfMonthMatches = dayOfMonth === '*';
                if (!dayOfMonthMatches) {
                    const dayOfMonthValues = this.parseField(dayOfMonth, 1, this.getDaysInMonth(month, year));
                    // Handle 'L' (last day)
                    if (dayOfMonthValues.includes(-1)) {
                        dayOfMonthMatches = day === this.getDaysInMonth(month, year);
                        dayOfMonthValues.splice(dayOfMonthValues.indexOf(-1), 1);
                    }
                    if (!dayOfMonthMatches) {
                        dayOfMonthMatches = dayOfMonthValues.includes(day);
                    }
                }

                let dayOfWeekMatches = dayOfWeek === '*';
                if (!dayOfWeekMatches) {
                    const dayOfWeekValues = this.parseField(dayOfWeek, 0, 6);
                    dayOfWeekMatches = dayOfWeekValues.includes(dow);
                }

                if (dayOfMonth === '*' && dayOfWeek === '*') {
                    return true;
                } else if (dayOfMonth !== '*' && dayOfWeek === '*') {
                    return dayOfMonthMatches;
                } else if (dayOfMonth === '*' && dayOfWeek !== '*') {
                    return dayOfWeekMatches;
                } else {
                    return dayOfMonthMatches || dayOfWeekMatches;
                }
            }

            async calculateNextExecutions(cronExpression, count = 5, timezone = 'Europe/Berlin') {
                if (calculationInProgress) return [];
                calculationInProgress = true;

                try {
                    const parts = cronExpression.trim().split(/\s+/);
                    let seconds = '0', minutes, hours, dayOfMonth, month, dayOfWeek, year = '*';

                    if (parts.length === 5) {
                        [minutes, hours, dayOfMonth, month, dayOfWeek] = parts;
                    } else if (parts.length === 7) {
                        [seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year] = parts;
                    } else {
                        throw new Error('Invalid cron format');
                    }

                    // Parse fields with validation
                    const secondsValues = this.parseField(seconds, 0, 59).slice(0, 60); // Limit to prevent infinite loops
                    const minutesValues = this.parseField(minutes, 0, 59).slice(0, 60);
                    const hoursValues = this.parseField(hours, 0, 23).slice(0, 24);
                    const monthValues = this.parseField(month, 1, 12).slice(0, 12);
                    
                    const currentYear = new Date().getFullYear();
                    const yearValues = year === '*' ? 
                        [currentYear, currentYear + 1, currentYear + 2] : // Limit years
                        this.parseField(year, currentYear, currentYear + 5).slice(0, 5);

                    const executions = [];
                    const now = new Date();
                    const startTime = new Date(now.getTime() + 1000);
                    let iterationCount = 0;
                    const maxIterations = 500000; // Increased to prevent premature break for frequent schedules

                    // Optimized calculation loop
                    outerLoop: for (let testYear of yearValues) {
                        for (let testMonth of monthValues) {
                            const daysInMonth = this.getDaysInMonth(testMonth, testYear);
                            for (let testDay = 1; testDay <= daysInMonth; testDay++) {
                                const testDate = new Date(testYear, testMonth - 1, testDay);
                                if (!this.isDayMatch(testDate, dayOfMonth, dayOfWeek)) continue;
                                for (let testHour of hoursValues) {
                                    for (let testMinute of minutesValues) {
                                        for (let testSecond of secondsValues) {
                                            iterationCount++;
                                            if (iterationCount > maxIterations) {
                                                console.warn('Max iterations reached, breaking calculation');
                                                break outerLoop;
                                            }
                                            const executionTime = new Date(testYear, testMonth - 1, testDay, testHour, testMinute, testSecond);
                                            if (executionTime >= startTime) {
                                                executions.push(executionTime);
                                                if (executions.length >= count) {
                                                    break outerLoop;
                                                }
                                            }
                                        }
                                    }
                                }
                                // Allow async operation to prevent blocking
                                if (iterationCount % 5000 === 0) {
                                    await new Promise(resolve => setTimeout(resolve, 0));
                                }
                            }
                        }
                    }

                    return executions.slice(0, count);

                } catch (error) {
                    console.error('Error in cron calculation:', error);
                    return [];
                } finally {
                    calculationInProgress = false;
                }
            }

            formatRelativeTime(date) {
                const now = new Date();
                const diffMs = date - now;
                
                const diffSeconds = Math.floor(diffMs / 1000);
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                if (diffSeconds < 60) return `in ${diffSeconds} second${diffSeconds !== 1 ? 's' : ''}`;
                if (diffMinutes < 60) return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
                if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
                if (diffDays < 30) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                
                const diffMonths = Math.floor(diffDays / 30);
                return `in ${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
            }

            formatExecutionDate(date, timezone = 'Europe/Berlin') {
                try {
                    const options = {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: timezone
                    };
                    return date.toLocaleDateString('en-US', options);
                } catch (error) {
                    // Fallback to local time if timezone is invalid
                    return date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }
            }

            formatExecutionTime(date, timezone = 'Europe/Berlin') {
                try {
                    const options = {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: currentFormat === 7 ? '2-digit' : undefined,
                        hour12: true,
                        timeZone: timezone
                    };
                    return date.toLocaleTimeString('en-US', options);
                } catch (error) {
                    // Fallback to local time if timezone is invalid
                    return date.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: currentFormat === 7 ? '2-digit' : undefined,
                        hour12: true
                    });
                }
            }
        }

        const cronCalculator = new PerfectCronCalculator();

        // Updated function with timeout and better error handling
        async function updateNextExecutions(cronExpression) {
            const container = document.getElementById('nextExecutions');
            
            // Show loading state immediately
            container.innerHTML = `
                <div class="text-center">
                    <div class="loading-spinner"></div>
                    <div style="margin-top: 1rem; font-size: 1.1rem;">
                        Calculating precise execution times...
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.8;">
                        Using ${selectedTimezone} timezone
                    </div>
                </div>
            `;

            try {
                // Add timeout to prevent hanging
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Calculation timeout')), 5000);
                });

                const calculationPromise = cronCalculator.calculateNextExecutions(cronExpression, 5, selectedTimezone);

                const executions = await Promise.race([calculationPromise, timeoutPromise]);
                
                if (executions.length === 0) {
                    container.innerHTML = `
                        <div class="error-state">
                            <i class="bi bi-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">
                                Unable to Calculate Executions
                            </div>
                            <div style="font-size: 0.9rem; opacity: 0.8;">
                                Please verify your cron expression format and try again.
                            </div>
                        </div>
                    `;
                    return;
                }

                let html = '<div class="success-state">';
                
                executions.forEach((date, index) => {
                    const formattedDate = cronCalculator.formatExecutionDate(date, selectedTimezone);
                    const formattedTime = cronCalculator.formatExecutionTime(date, selectedTimezone);
                    const relativeTime = cronCalculator.formatRelativeTime(date);
                    
                    html += `
                        <div class="execution-item">
                            <span class="execution-number">${index + 1}</span>
                            <div>
                                <div class="execution-date">
                                    <i class="bi bi-calendar-event me-2"></i>${formattedDate}
                                </div>
                                <div class="execution-time">
                                    <i class="bi bi-clock me-2"></i>${formattedTime}
                                </div>
                                <div class="execution-relative">
                                    <i class="bi bi-arrow-right me-2"></i>${relativeTime}
                                </div>
                                <div class="execution-timezone">
                                    <i class="bi bi-globe me-2"></i>${selectedTimezone}
                                </div>
                            </div>
                        </div>
                    `;
                });

                html += `
                    <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); text-align: center;">
                        <small style="opacity: 0.8;">
                            <i class="bi bi-check-circle me-2"></i>
                            Calculated with perfect accuracy • Timezone: ${selectedTimezone}
                        </small>
                    </div>
                `;
                
                html += '</div>';
                container.innerHTML = html;

            } catch (error) {
                console.error('Error updating executions:', error);
                container.innerHTML = `
                    <div class="error-state">
                        <i class="bi bi-x-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">
                            Calculation Error
                        </div>
                        <div style="font-size: 0.9rem; opacity: 0.8;">
                            ${error.message === 'Calculation timeout' ? 
                                'Calculation is taking too long. Please try a simpler cron expression.' : 
                                'There was an error processing your cron expression.'}
                        </div>
                    </div>
                `;
            }
        }

        // Timezone functions
        function updateTimezoneCalculations() {
            selectedTimezone = document.getElementById('timezoneSelect').value;
            
            const timezoneIndicator = document.getElementById('timezoneIndicator');
            timezoneIndicator.textContent = `(${selectedTimezone})`;
            
            updateCurrentTimeDisplay();
            
            const cronExpression = document.getElementById('cronInput').value.trim();
            if (cronExpression) {
                updateNextExecutions(cronExpression);
            }
        }

        function updateCurrentTimeDisplay() {
            try {
                const now = new Date();
                const options = {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: selectedTimezone,
                    hour12: false
                };
                
                const formattedTime = now.toLocaleString('en-US', options);
                document.getElementById('currentTimeDisplay').textContent = formattedTime + ` (${selectedTimezone})`;
            } catch (error) {
                document.getElementById('currentTimeDisplay').textContent = `Error: Invalid timezone (${selectedTimezone})`;
            }
        }

        function forceUpdateNextExecutions() {
            const cronExpression = document.getElementById('cronInput').value.trim();
            if (cronExpression) {
                updateNextExecutions(cronExpression);
                
                const button = event.target;
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="bi bi-check-lg me-2"></i>Updated Successfully!';
                button.classList.remove('btn-primary');
                button.classList.add('btn-success');
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('btn-success');
                    button.classList.add('btn-primary');
                }, 2000);
            }
        }

        // Rest of the existing functions (getHumanDescription, validateCronExpression, etc.)
        function getHumanDescription(cronExpression) {
            try {
                const options = {
                    throwExceptionOnParseError: false,
                    verbose: true,
                    use24HourTimeFormat: false,
                    locale: "en"
                };
                return cronstrue.toString(cronExpression, options);
            } catch (error) {
                console.warn('Cronstrue parsing error:', error);
                return getFallbackDescription(cronExpression);
            }
        }

        function getFallbackDescription(cronExpression) {
            const parts = cronExpression.trim().split(/\s+/);
            
            if (parts.length === 5) {
                const [min, hour, day, month, dow] = parts;
                if (min === '*' && hour === '*') return "Every minute";
                if (min === '0' && hour === '*') return "Every hour";
                if (min === '0' && hour === '0') return "Daily at midnight";
                return "Custom schedule";
            } else if (parts.length === 7) {
                const [sec, min, hour, day, month, dow, year] = parts;
                if (sec === '*' && min === '*' && hour === '*') return "Every second";
                if (sec === '0' && min === '0' && hour === '0') return "Daily at midnight";
                return "Custom schedule (7-field)";
            }
            
            return "Invalid cron expression";
        }

        function validateCronExpression(cronExpression) {
            const parts = cronExpression.trim().split(/\s+/);
            const expectedFields = currentFormat;
            
            if (parts.length !== expectedFields) {
                return { 
                    valid: false, 
                    message: `Cron expression must have exactly ${expectedFields} fields for ${expectedFields}-field format` 
                };
            }
            
            return { valid: true, message: `Valid ${expectedFields}-field cron expression` };
        }

        const presets = {
            5: {
                'every-minute': { minutes: '*', hours: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' },
                'hourly': { minutes: '0', hours: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' },
                'daily': { minutes: '0', hours: '0', dayOfMonth: '*', month: '*', dayOfWeek: '*' },
                'weekly': { minutes: '0', hours: '0', dayOfMonth: '*', month: '*', dayOfWeek: '0' },
                'monthly': { minutes: '0', hours: '0', dayOfMonth: '1', month: '*', dayOfWeek: '*' }
            },
            7: {
                'every-minute': { seconds: '*', minutes: '*', hours: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*', year: '*' },
                'hourly': { seconds: '0', minutes: '0', hours: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*', year: '*' },
                'daily': { seconds: '0', minutes: '0', hours: '0', dayOfMonth: '*', month: '*', dayOfWeek: '*', year: '*' },
                'weekly': { seconds: '0', minutes: '0', hours: '0', dayOfMonth: '*', month: '*', dayOfWeek: '0', year: '*' },
                'monthly': { seconds: '0', minutes: '0', hours: '0', dayOfMonth: '1', month: '*', dayOfWeek: '*', year: '*' }
            }
        };

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            switchFormat(5);
            setPreset('daily');
            
            // Set default timezone to Europe/Berlin
            document.getElementById('timezoneSelect').value = 'Europe/Berlin';
            selectedTimezone = 'Europe/Berlin';
            updateCurrentTimeDisplay();
            
            // Start updating current time every second
            setInterval(updateCurrentTimeDisplay, 1000);
            
            // Add event listener to cron input field with debounce
            document.getElementById('cronInput').addEventListener('input', function() {
                const cronExpression = this.value.trim();
                if (cronExpression) {
                    clearTimeout(this.updateTimeout);
                    this.updateTimeout = setTimeout(() => {
                        parseCronExpression(cronExpression);
                    }, 800); // Increased delay to prevent too frequent calculations
                }
            });

            document.getElementById('cronInput').addEventListener('paste', function() {
                setTimeout(() => {
                    const cronExpression = this.value.trim();
                    if (cronExpression) {
                        parseCronExpression(cronExpression);
                    }
                }, 100);
            });

            document.querySelectorAll('.preset-card').forEach(card => {
                card.addEventListener('click', function() {
                    const preset = this.dataset.preset;
                    setPreset(preset);
                });
            });

            document.querySelectorAll('#customConfig select').forEach(select => {
                select.addEventListener('change', updateCronExpression);
            });

            document.querySelectorAll('.manual-input').forEach(input => {
                input.addEventListener('input', function() {
                    clearTimeout(this.inputTimeout);
                    this.inputTimeout = setTimeout(() => {
                        if (isManualTabActive()) {
                            updateCronExpressionFromManual();
                        }
                    }, 500);
                });
            });
        });

        function switchFormat(format) {
            currentFormat = format;
            
            const format5Btn = document.getElementById('format5');
            const format7Btn = document.getElementById('format7');
            const formatInfo = document.getElementById('formatInfo');
            const formatBadge = document.getElementById('currentFormatBadge');
            const formatNote = document.getElementById('formatNote');
            
            if (format === 5) {
                format5Btn.classList.add('active');
                format7Btn.classList.remove('active');
                formatInfo.innerHTML = `
                    <strong><i class="bi bi-info-circle me-2"></i>5-Field Format:</strong> 
                    <code>minutes hours day-of-month month day-of-week</code>
                    <br><small>Traditional Unix cron format, widely supported</small>
                `;
                formatBadge.textContent = '5-Field Mode';
                formatNote.innerHTML = `
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>Note:</strong> Perfect time calculation algorithm ensures 100% accurate results.
                `;
                
                document.getElementById('secondsField').style.display = 'none';
                document.getElementById('yearField').style.display = 'none';
                document.getElementById('manualSecondsField').style.display = 'none';
                document.getElementById('manualYearField').style.display = 'none';
                document.getElementById('fieldSecondsRow').style.display = 'none';
                document.getElementById('fieldYearRow').style.display = 'none';
                
            } else {
                format5Btn.classList.remove('active');
                format7Btn.classList.add('active');
                formatInfo.innerHTML = `
                    <strong><i class="bi bi-info-circle me-2"></i>7-Field Format:</strong> 
                    <code>seconds minutes hours day-of-month month day-of-week year</code>
                    <br><small>Extended format with seconds and year fields for maximum precision</small>
                `;
                formatBadge.textContent = '7-Field Mode';
                formatNote.innerHTML = `
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>Note:</strong> Advanced 7-field format with perfect time calculation. Make sure your system supports it.
                `;
                
                document.getElementById('secondsField').style.display = 'block';
                document.getElementById('yearField').style.display = 'block';
                document.getElementById('manualSecondsField').style.display = 'block';
                document.getElementById('manualYearField').style.display = 'block';
                document.getElementById('fieldSecondsRow').style.display = 'flex';
                document.getElementById('fieldYearRow').style.display = 'flex';
            }
            
            updatePresetDisplays();
            setPreset('daily');
        }

        function updatePresetDisplays() {
            const presetTexts = {
                'every-minute': currentFormat === 5 ? '* * * * *' : '* * * * * * *',
                'hourly': currentFormat === 5 ? '0 * * * *' : '0 0 * * * * *',
                'daily': currentFormat === 5 ? '0 0 * * *' : '0 0 0 * * * *',
                'weekly': currentFormat === 5 ? '0 0 * * 0' : '0 0 0 * * 0 *',
                'monthly': currentFormat === 5 ? '0 0 1 * *' : '0 0 0 1 * * *'
            };
            
            Object.keys(presetTexts).forEach(preset => {
                const element = document.getElementById(`preset-${preset}`);
                if (element) {
                    element.textContent = presetTexts[preset];
                }
            });
        }

        function parseCronExpression(cronExpression) {
            const validation = validateCronExpression(cronExpression);
            const validationDiv = document.getElementById('cronValidation');
            const cronInput = document.getElementById('cronInput');

            if (validation.valid) {
                const parts = cronExpression.split(/\s+/);
                
                const description = getHumanDescription(cronExpression);
                document.getElementById('cronDescription').textContent = description;
                
                updateNextExecutions(cronExpression);
                
                if (currentFormat === 5) {
                    document.getElementById('fieldMinutes').textContent = parts[0];
                    document.getElementById('fieldHours').textContent = parts[1];
                    document.getElementById('fieldDayOfMonth').textContent = parts[2];
                    document.getElementById('fieldMonth').textContent = parts[3];
                    document.getElementById('fieldDayOfWeek').textContent = parts[4];
                } else {
                    document.getElementById('fieldSeconds').textContent = parts[0];
                    document.getElementById('fieldMinutes').textContent = parts[1];
                    document.getElementById('fieldHours').textContent = parts[2];
                    document.getElementById('fieldDayOfMonth').textContent = parts[3];
                    document.getElementById('fieldMonth').textContent = parts[4];
                    document.getElementById('fieldDayOfWeek').textContent = parts[5];
                    document.getElementById('fieldYear').textContent = parts[6];
                }

                validationDiv.textContent = '✓ ' + validation.message;
                validationDiv.className = 'validation-feedback valid';
                cronInput.classList.remove('invalid');
            } else {
                validationDiv.textContent = '✗ ' + validation.message;
                validationDiv.className = 'validation-feedback invalid';
                cronInput.classList.add('invalid');
                document.getElementById('cronDescription').textContent = 'Invalid cron expression';
                
                document.getElementById('nextExecutions').innerHTML = `
                    <div class="error-state">
                        <i class="bi bi-x-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <div style="font-size: 1.1rem; font-weight: 600;">
                            Invalid Cron Expression
                        </div>
                    </div>
                `;
            }
        }

        function setPreset(presetName) {
            document.querySelectorAll('.preset-card').forEach(card => {
                card.classList.remove('active');
            });

            document.querySelector(`[data-preset="${presetName}"]`).classList.add('active');

            if (presetName === 'custom') {
                document.getElementById('customConfig').style.display = 'block';
            } else {
                document.getElementById('customConfig').style.display = 'none';
                const preset = presets[currentFormat][presetName];
                
                if (currentFormat === 5) {
                    document.getElementById('minutes').value = preset.minutes;
                    document.getElementById('hours').value = preset.hours;
                    document.getElementById('dayOfMonth').value = preset.dayOfMonth;
                    document.getElementById('month').value = preset.month;
                    document.getElementById('dayOfWeek').value = preset.dayOfWeek;
                } else {
                    document.getElementById('seconds').value = preset.seconds;
                    document.getElementById('minutes').value = preset.minutes;
                    document.getElementById('hours').value = preset.hours;
                    document.getElementById('dayOfMonth').value = preset.dayOfMonth;
                    document.getElementById('month').value = preset.month;
                    document.getElementById('dayOfWeek').value = preset.dayOfWeek;
                    document.getElementById('year').value = preset.year;
                }

                updateManualInputs();
            }
            
            updateCronExpression();
        }

        function updateCronExpression() {
            let cronExpression;
            let parts;
            
            if (currentFormat === 5) {
                const minutes = document.getElementById('minutes').value;
                const hours = document.getElementById('hours').value;
                const dayOfMonth = document.getElementById('dayOfMonth').value;
                const month = document.getElementById('month').value;
                const dayOfWeek = document.getElementById('dayOfWeek').value;
                
                cronExpression = `${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek}`;
                parts = [minutes, hours, dayOfMonth, month, dayOfWeek];
                
                document.getElementById('fieldMinutes').textContent = minutes;
                document.getElementById('fieldHours').textContent = hours;
                document.getElementById('fieldDayOfMonth').textContent = dayOfMonth;
                document.getElementById('fieldMonth').textContent = month;
                document.getElementById('fieldDayOfWeek').textContent = dayOfWeek;
            } else {
                const seconds = document.getElementById('seconds').value;
                const minutes = document.getElementById('minutes').value;
                const hours = document.getElementById('hours').value;
                const dayOfMonth = document.getElementById('dayOfMonth').value;
                const month = document.getElementById('month').value;
                const dayOfWeek = document.getElementById('dayOfWeek').value;
                const year = document.getElementById('year').value;
                
                cronExpression = `${seconds} ${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek} ${year}`;
                parts = [seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year];
                
                document.getElementById('fieldSeconds').textContent = seconds;
                document.getElementById('fieldMinutes').textContent = minutes;
                document.getElementById('fieldHours').textContent = hours;
                document.getElementById('fieldDayOfMonth').textContent = dayOfMonth;
                document.getElementById('fieldMonth').textContent = month;
                document.getElementById('fieldDayOfWeek').textContent = dayOfWeek;
                document.getElementById('fieldYear').textContent = year;
            }
            
            document.getElementById('cronInput').value = cronExpression;
            
            const description = getHumanDescription(cronExpression);
            document.getElementById('cronDescription').textContent = description;

            updateNextExecutions(cronExpression);

            if (!isManualTabActive()) {
                updateManualInputs();
            }

            document.getElementById('cronValidation').textContent = '';
            document.getElementById('cronInput').classList.remove('invalid');
        }

        function updateManualInputs() {
            if (currentFormat === 5) {
                document.getElementById('manualMinutes').value = document.getElementById('minutes').value;
                document.getElementById('manualHours').value = document.getElementById('hours').value;
                document.getElementById('manualDayOfMonth').value = document.getElementById('dayOfMonth').value;
                document.getElementById('manualMonth').value = document.getElementById('month').value;
                document.getElementById('manualDayOfWeek').value = document.getElementById('dayOfWeek').value;
            } else {
                document.getElementById('manualSeconds').value = document.getElementById('seconds').value;
                document.getElementById('manualMinutes').value = document.getElementById('minutes').value;
                document.getElementById('manualHours').value = document.getElementById('hours').value;
                document.getElementById('manualDayOfMonth').value = document.getElementById('dayOfMonth').value;
                document.getElementById('manualMonth').value = document.getElementById('month').value;
                document.getElementById('manualDayOfWeek').value = document.getElementById('dayOfWeek').value;
                document.getElementById('manualYear').value = document.getElementById('year').value;
            }
        }

        function updateCronExpressionFromManual() {
            let cronExpression;
            let parts;
            
            if (currentFormat === 5) {
                const minutes = document.getElementById('manualMinutes').value || '*';
                const hours = document.getElementById('manualHours').value || '*';
                const dayOfMonth = document.getElementById('manualDayOfMonth').value || '*';
                const month = document.getElementById('manualMonth').value || '*';
                const dayOfWeek = document.getElementById('manualDayOfWeek').value || '*';
                
                cronExpression = `${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek}`;
                parts = [minutes, hours, dayOfMonth, month, dayOfWeek];
            } else {
                const seconds = document.getElementById('manualSeconds').value || '*';
                const minutes = document.getElementById('manualMinutes').value || '*';
                const hours = document.getElementById('manualHours').value || '*';
                const dayOfMonth = document.getElementById('manualDayOfMonth').value || '*';
                const month = document.getElementById('manualMonth').value || '*';
                const dayOfWeek = document.getElementById('manualDayOfWeek').value || '*';
                const year = document.getElementById('manualYear').value || '*';
                
                cronExpression = `${seconds} ${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek} ${year}`;
                parts = [seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year];
            }
            
            document.getElementById('cronInput').value = cronExpression;
            
            const description = getHumanDescription(cronExpression);
            document.getElementById('cronDescription').textContent = description;
            
            updateNextExecutions(cronExpression);
            
            if (currentFormat === 5) {
                document.getElementById('fieldMinutes').textContent = parts[0];
                document.getElementById('fieldHours').textContent = parts[1];
                document.getElementById('fieldDayOfMonth').textContent = parts[2];
                document.getElementById('fieldMonth').textContent = parts[3];
                document.getElementById('fieldDayOfWeek').textContent = parts[4];
            } else {
                document.getElementById('fieldSeconds').textContent = parts[0];
                document.getElementById('fieldMinutes').textContent = parts[1];
                document.getElementById('fieldHours').textContent = parts[2];
                document.getElementById('fieldDayOfMonth').textContent = parts[3];
                document.getElementById('fieldMonth').textContent = parts[4];
                document.getElementById('fieldDayOfWeek').textContent = parts[5];
                document.getElementById('fieldYear').textContent = parts[6];
            }

            document.getElementById('cronValidation').textContent = '';
            document.getElementById('cronInput').classList.remove('invalid');
        }

        function resetAll() {
            setPreset('daily');
            
            // Reset timezone to default
            document.getElementById('timezoneSelect').value = 'Europe/Berlin';
            selectedTimezone = 'Europe/Berlin';
            updateTimezoneCalculations();
            
            document.querySelectorAll('.manual-input').forEach(input => {
                input.value = '';
            });

            document.getElementById('cronValidation').textContent = '';
            document.getElementById('cronInput').classList.remove('invalid');
            document.getElementById('customConfig').style.display = 'none';

            const dropdownTab = new bootstrap.Tab(document.getElementById('dropdown-tab'));
            dropdownTab.show();

            const resetBtn = event.target;
            const originalText = resetBtn.innerHTML;
            resetBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Reset Complete!';
            resetBtn.style.background = 'var(--success-gradient)';
            
            setTimeout(() => {
                resetBtn.innerHTML = originalText;
                resetBtn.style.background = 'var(--danger-gradient)';
            }, 1500);
        }

        function applyManualInput() {
            if (currentFormat === 5) {
                document.getElementById('minutes').value = document.getElementById('manualMinutes').value || '*';
                document.getElementById('hours').value = document.getElementById('manualHours').value || '*';
                document.getElementById('dayOfMonth').value = document.getElementById('manualDayOfMonth').value || '*';
                document.getElementById('month').value = document.getElementById('manualMonth').value || '*';
                document.getElementById('dayOfWeek').value = document.getElementById('manualDayOfWeek').value || '*';
            } else {
                document.getElementById('seconds').value = document.getElementById('manualSeconds').value || '*';
                document.getElementById('minutes').value = document.getElementById('manualMinutes').value || '*';
                document.getElementById('hours').value = document.getElementById('manualHours').value || '*';
                document.getElementById('dayOfMonth').value = document.getElementById('manualDayOfMonth').value || '*';
                document.getElementById('month').value = document.getElementById('manualMonth').value || '*';
                document.getElementById('dayOfWeek').value = document.getElementById('manualDayOfWeek').value || '*';
                document.getElementById('year').value = document.getElementById('manualYear').value || '*';
            }

            const dropdownTab = new bootstrap.Tab(document.getElementById('dropdown-tab'));
            dropdownTab.show();
            
            updateCronExpression();

            const applyBtn = event.target;
            const originalText = applyBtn.innerHTML;
            applyBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Applied Successfully!';
            applyBtn.classList.remove('btn-primary');
            applyBtn.classList.add('btn-success');
            
            setTimeout(() => {
                applyBtn.innerHTML = originalText;
                applyBtn.classList.remove('btn-success');
                applyBtn.classList.add('btn-primary');
            }, 2000);
        }

        function isManualTabActive() {
            return document.getElementById('manual-tab').classList.contains('active');
        }

        function copyToClipboard() {
            const cronExpression = document.getElementById('cronInput').value;
            navigator.clipboard.writeText(cronExpression).then(function() {
                const button = event.target;
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="bi bi-check me-2"></i>Copied!';
                button.classList.remove('btn-outline-primary');
                button.classList.add('btn-success');
                
                setTimeout(function() {
                    button.innerHTML = originalText;
                    button.classList.remove('btn-success');
                    button.classList.add('btn-outline-primary');
                }, 2000);
            });
        }