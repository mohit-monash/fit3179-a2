document.addEventListener("DOMContentLoaded", async () => {
  const yearSelect = document.getElementById("year-select");
  const citySelect = document.getElementById("city-select");
  const searchInput = document.getElementById("sa3-search");
  const cityYearSlider = document.getElementById("city-year-slider");
  const cityYearDisplay = document.getElementById("city-year-display");

  const yearLabels = {
    2018: "2017–18",
    2019: "2018–19",
    2020: "2019–20",
    2021: "2020–21",
    2022: "2021–22"
  };

  const embedOptions = { actions: false, renderer: "canvas" };

  function getCityLabel(value) {
    if (!value) {
      return "";
    }
    const option = Array.from(citySelect.options).find(
      (opt) => opt.value === value
    );
    return option ? option.text.trim() : value.replace("Greater ", "");
  }

  function getYearValue() {
    return Number(yearSelect.value);
  }

  function getYearLabel(yearValue) {
    return yearLabels[yearValue] || `${yearValue - 1}–${yearValue}`;
  }

  function updateCityYearDisplay(yearValue) {
    if (!cityYearDisplay) {
      return;
    }
    cityYearDisplay.textContent = getYearLabel(yearValue);
  }

  const [
    kpiResult,
    overviewResult,
    cityResult,
    stateTrendResult,
    salaryShareResult,
    sa3Result,
    timeseriesResult,
    distributionResult
  ] = await Promise.all([
    vegaEmbed("#kpi-vis", "specs/kpi_cards.vg.json", embedOptions),
    vegaEmbed("#overview-vis", "specs/state_overview.vg.json", embedOptions),
    vegaEmbed("#city-vis", "specs/city_comparator.vg.json", embedOptions),
    vegaEmbed("#state-trend-vis", "specs/state_trend.vg.json", embedOptions),
    vegaEmbed("#salary-share-vis", "specs/salary_share.vg.json", embedOptions),
    vegaEmbed("#sa3-vis", "specs/sa3_map_rank.vg.json", embedOptions),
    vegaEmbed("#timeseries-vis", "specs/time_series.vg.json", embedOptions),
    vegaEmbed("#distribution-vis", "specs/distribution.vg.json", embedOptions)
  ]);

  const views = {
    kpi: kpiResult.view,
    overview: overviewResult.view,
    city: cityResult.view,
    stateTrend: stateTrendResult.view,
    salaryShare: salaryShareResult.view,
    sa3: sa3Result.view,
    timeseries: timeseriesResult.view,
    distribution: distributionResult.view
  };

  async function updateCityYear(yearValue, { syncSlider = false } = {}) {
    if (syncSlider && cityYearSlider) {
      cityYearSlider.value = String(yearValue);
    }
    updateCityYearDisplay(yearValue);
    await setSignals(views.city, {
      yearParam: yearValue
    });
  }

  async function updateKpiSignals() {
    const yearValue = getYearValue();
    const cityValue = citySelect.value;
    await setSignals(views.kpi, {
      yearParam: yearValue,
      yearLabelParam: getYearLabel(yearValue),
      cityParam: cityValue,
      cityLabelParam: getCityLabel(cityValue)
    });
  }

  function debounce(fn, wait = 150) {
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
        // Ignore missing signals on a view.
      }
    }
    if (dirty) {
      await view.runAsync();
    }
  }

  let previousCity = citySelect.value;

  const updateYearDrivenViews = async () => {
    const yearValue = getYearValue();

    await updateKpiSignals();

    await setSignals(views.overview, {
      yearParam: yearValue
    });

    await setSignals(views.salaryShare, {
      yearParam: yearValue
    });

    await setSignals(views.sa3, {
      yearParam: yearValue
    });

    await setSignals(views.timeseries, {
      yearParam: yearValue
    });

    await setSignals(views.distribution, {
      yearParam: yearValue
    });

    await updateCityYear(yearValue, { syncSlider: true });
  };

  const updateCityDrivenViews = async () => {
    const cityValue = citySelect.value;
    let searchValue = searchInput.value.trim();

    const cityYearValue = cityYearSlider
      ? Number(cityYearSlider.value)
      : getYearValue();

    await updateCityYear(cityYearValue);

    if (previousCity !== cityValue) {
      searchInput.value = "";
      searchValue = "";
    }

    await updateKpiSignals();

    await setSignals(views.sa3, {
      cityParam: cityValue,
      searchParam: searchValue
    });

    await setSignals(views.distribution, {
      cityParam: cityValue
    });

    if (previousCity !== cityValue) {
      try {
        views.sa3.signal("sa3_select", null);
        await views.sa3.runAsync();
      } catch (error) {
        console.warn("Unable to reset SA3 selection:", error);
      }
      previousCity = cityValue;
    }
  };

  const handleSearchInput = debounce(async () => {
    await setSignals(views.sa3, {
      searchParam: searchInput.value.trim()
    });
  });

  yearSelect.addEventListener("change", () => {
    updateYearDrivenViews();
  });

  citySelect.addEventListener("change", () => {
    updateCityDrivenViews();
  });

  searchInput.addEventListener("input", handleSearchInput);

  if (cityYearSlider) {
    updateCityYearDisplay(Number(cityYearSlider.value || getYearValue()));
    cityYearSlider.addEventListener("input", () => {
      const yearValue = Number(cityYearSlider.value);
      updateCityYear(yearValue).catch((error) => {
        console.warn("Unable to update capital city year:", error);
      });
    });
  }

  // Initial renders
  await updateYearDrivenViews();
  await updateCityDrivenViews();
});
