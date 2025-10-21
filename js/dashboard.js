document.addEventListener("DOMContentLoaded", async () => {
  const citySelect = document.getElementById("city-select");
  const metricSelect = document.getElementById("metric-select");
  const yearSelect = document.getElementById("year-select");
  const searchInput = document.getElementById("sa3-search");
  const searchWrapper = document.getElementById("sa3-search-wrapper");

  const stateByCity = {
    Australia: "Australia",
    "Greater Sydney": "New South Wales",
    "Greater Melbourne": "Victoria",
    "Greater Brisbane": "Queensland",
    "Greater Adelaide": "South Australia",
    "Greater Perth": "Western Australia",
    "Greater Hobart": "Tasmania",
    "Australian Capital Territory": "Australian Capital Territory",
    "Greater Darwin": "Northern Territory"
  };

  const yearLabels = {
    2018: "2017–18",
    2019: "2018–19",
    2020: "2019–20",
    2021: "2020–21",
    2022: "2021–22"
  };

  const embedOptions = { actions: false, renderer: "canvas" };

  const [
    kpiResult,
    overviewResult,
    cityResult,
    sa3Result,
    timeseriesResult,
    distributionResult
  ] = await Promise.all([
    vegaEmbed("#kpi-vis", "specs/kpi_cards.vg.json", embedOptions),
    vegaEmbed("#overview-vis", "specs/state_overview.vg.json", embedOptions),
    vegaEmbed("#city-vis", "specs/city_comparator.vg.json", embedOptions),
    vegaEmbed("#sa3-vis", "specs/sa3_map_rank.vg.json", embedOptions),
    vegaEmbed("#timeseries-vis", "specs/time_series.vg.json", embedOptions),
    vegaEmbed("#distribution-vis", "specs/distribution.vg.json", embedOptions)
  ]);

  const views = {
    kpi: kpiResult.view,
    overview: overviewResult.view,
    city: cityResult.view,
    sa3: sa3Result.view,
    timeseries: timeseriesResult.view,
    distribution: distributionResult.view
  };

  function getCityLabel(value) {
    if (value === "Australia") {
      return "Australia";
    }
    const option = Array.from(citySelect.options).find(
      (opt) => opt.value === value
    );
    return option ? option.text : value;
  }

  function debounce(fn, wait = 200) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  async function setSignals(view, mapping) {
    if (!view) {
      return;
    }
    let dirty = false;
    for (const [name, value] of Object.entries(mapping)) {
      if (typeof view.signal !== "function") {
        continue;
      }
      try {
        const current = view.signal(name);
        const bothNaN = Number.isNaN(current) && Number.isNaN(value);
        if (current === value || bothNaN) {
          continue;
        }
        view.signal(name, value);
        dirty = true;
      } catch (error) {
        // Signal might not exist on this view; ignore silently.
      }
    }
    if (dirty) {
      await view.runAsync();
    }
  }

  let previousCity = citySelect.value;
  let previousMetric = metricSelect.value;

  const performUpdate = async () => {
    const cityValue = citySelect.value;
    const metricValue = metricSelect.value;
    const yearValue = Number(yearSelect.value);
    const stateValue = stateByCity[cityValue] || "Australia";
    const yearLabel = yearLabels[yearValue] || `${yearValue - 1}–${yearValue}`;
    const cityLabel = getCityLabel(cityValue);

    if (cityValue === "Australia") {
      searchWrapper.classList.add("hidden");
      if (searchInput.value !== "") {
        searchInput.value = "";
      }
    } else {
      searchWrapper.classList.remove("hidden");
    }
    const searchValue =
      cityValue === "Australia" ? "" : searchInput.value.trim();

    await setSignals(views.kpi, {
      cityParam: cityValue,
      cityLabelParam: cityLabel,
      yearParam: yearValue,
      yearLabelParam: yearLabel
    });

    await setSignals(views.overview, {
      cityParam: cityValue,
      stateParam: stateValue,
      yearParam: yearValue
    });

    await setSignals(views.city, {
      cityParam: cityValue,
      yearParam: yearValue
    });

    await setSignals(views.timeseries, {
      cityParam: cityValue,
      stateParam: stateValue,
      yearParam: yearValue
    });

    await setSignals(views.distribution, {
      cityParam: cityValue,
      yearParam: yearValue,
      metricParam: metricValue
    });

    const cityChanged = previousCity !== cityValue;
    const metricChanged = previousMetric !== metricValue;

    await setSignals(views.sa3, {
      cityParam: cityValue,
      yearParam: yearValue,
      metricParam: metricValue,
      searchParam: searchValue
    });

    if (cityChanged || metricChanged) {
      try {
        views.sa3.signal("sa3_select", null);
        await views.sa3.runAsync();
      } catch (error) {
        console.warn("Unable to reset SA3 selection:", error);
      }
    }

    previousCity = cityValue;
    previousMetric = metricValue;
  };

  const updateViews = debounce(performUpdate, 60);

  citySelect.addEventListener("change", () => updateViews());
  metricSelect.addEventListener("change", () => updateViews());
  yearSelect.addEventListener("change", () => updateViews());
  searchInput.addEventListener("input", updateViews);

  // Initial render
  performUpdate();
});
